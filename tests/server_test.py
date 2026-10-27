import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('studio_server', Path(__file__).parents[1] / 'studio-server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class FinishingTests(unittest.TestCase):
    def test_master_song_and_frame_trim(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            song, clip = secrets.token_hex(16), secrets.token_hex(16)
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=10.25','-c:a','pcm_s16le','-f','wav',str(folder/song)],check=True)
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=teal:s=128x72:r=24:d=6','-c:v','libx264','-pix_fmt','yuv420p','-f','mp4',str(folder/clip)],check=True)
            result = server.assemble(folder, {'songId':song,'clips':[{'id':clip,'frames':123},{'id':clip,'frames':123}],'fps':24,'aspect':'16:9'})
            info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,duration,nb_frames:format=duration','-of','json',str(folder/result)]))
            video=next(s for s in info['streams'] if s['codec_type']=='video')
            audio=next(s for s in info['streams'] if s['codec_type']=='audio')
            self.assertEqual(int(video['nb_frames']),246)
            self.assertAlmostEqual(float(video['duration']),246/24,places=5)
            self.assertAlmostEqual(float(audio['duration']),10.25,places=2)
            self.assertAlmostEqual(float(info['format']['duration']),10.25,places=2)
            # Short outputs must fail instead of freezing a frame across missing footage.
            with self.assertRaisesRegex(ValueError,'shorter'):
                server.assemble(folder,{'songId':song,'clips':[{'id':clip,'frames':240}],'fps':24,'aspect':'16:9'})

    def test_output_quality_scale_is_bounded_and_preserves_delivery_resolution(self):
        self.assertEqual(server.finishing_dimensions({'aspect':'16:9'}), (1344,768))
        self.assertEqual(server.finishing_dimensions({'aspect':'16:9','outputScale':2}), (2688,1536))
        self.assertEqual(server.finishing_dimensions({'aspect':'9:16','outputScale':1.5}), (1152,2016))
        for scale in [True, '2', 100, -1, float('nan'), 4]:
            with self.assertRaises(ValueError):
                server.finishing_dimensions({'aspect':'16:9','outputScale':scale})

    def test_request_cannot_select_arbitrary_local_files(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                server.media_path(Path(directory),'../../etc/passwd')
            with self.assertRaises(ValueError):
                server.assemble(Path(directory), {'songId':'../../etc/passwd','clips':[],'fps':24,'aspect':'16:9'})

    def test_real_edit_ending_frame_and_generated_audio_assembly(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            clip, silent = secrets.token_hex(16), secrets.token_hex(16)
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=red:s=128x72:r=24:d=4','-f','lavfi','-i','color=c=blue:s=128x72:r=24:d=1','-f','lavfi','-i','sine=frequency=440:duration=5','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-map','2:a','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p','-f','mp4',str(folder/clip)],check=True)
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=green:s=128x72:r=24:d=4','-c:v','libx264','-pix_fmt','yuv420p','-f','mp4',str(folder/silent)],check=True)
            def pixel(token):
                return subprocess.check_output(['ffmpeg','-v','error','-i',str(folder/token),'-vf','scale=1:1','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'])
            ending=server.extract_frame(folder, {'id':clip,'frames':96})
            tail=server.extract_frame(folder, {'id':clip,'frames':120})
            self.assertGreater(pixel(ending)[0],200)
            self.assertLess(pixel(ending)[2],30)
            self.assertGreater(pixel(tail)[2],200)
            result=server.assemble(folder, {'clips':[{'id':clip,'frames':96},{'id':silent,'frames':96}],'fps':24,'aspect':'16:9'})
            info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,nb_frames,duration','-of','json',str(folder/result)]))
            self.assertEqual(int(next(x for x in info['streams'] if x['codec_type']=='video')['nb_frames']),192)
            self.assertTrue(any(x['codec_type']=='audio' for x in info['streams']))
            import array
            pcm=array.array('h',subprocess.check_output(['ffmpeg','-v','error','-i',str(folder/result),'-map','0:a:0','-ac','1','-ar','8000','-f','s16le','-']))
            energy=lambda start:sum(abs(x) for x in pcm[start*8000:(start+1)*8000])/8000
            self.assertGreater(energy(1),100)
            self.assertLess(energy(6),10)
            for frames in [True,0,400]:
                with self.assertRaises(ValueError):server.extract_frame(folder, {'id':clip,'frames':frames})

    def test_ai_timeout_validation(self):
        self.assertEqual(server.ai_timeout_seconds(),1800)
        self.assertEqual(server.ai_timeout_seconds(3600),3600)
        for value in [True,0,59,7201,'1800',None]:
            with self.assertRaises(ValueError):server.ai_timeout_seconds(value)

    def test_ai_relay_uses_selected_timeout_and_returns_504(self):
        import http.client
        import threading
        from unittest import mock
        httpd=server.http.server.ThreadingHTTPServer(('127.0.0.1',0),server.StudioHandler)
        httpd.token='timeout-test-token'
        thread=threading.Thread(target=httpd.serve_forever,daemon=True)
        thread.start()
        client=http.client.HTTPConnection('127.0.0.1',httpd.server_port,timeout=5)
        try:
            with mock.patch.object(server.urllib.request,'build_opener') as builder:
                builder.return_value.open.side_effect=TimeoutError('upstream timed out')
                body=json.dumps({'endpoint':'http://127.0.0.1:8000/v1','route':'chat/completions','timeoutSeconds':3600,'payload':{'messages':[]}})
                client.request('POST','/api/ai/request',body,{'Origin':f'http://127.0.0.1:{httpd.server_port}','X-Studio-Token':httpd.token,'Content-Type':'application/json'})
                response=client.getresponse()
                data=json.loads(response.read())
                self.assertEqual(response.status,504)
                self.assertIn('60 minutes',data['error'])
                self.assertEqual(builder.return_value.open.call_args.kwargs['timeout'],3600)
        finally:
            client.close()
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=5)

    def test_uploaded_video_joining_supports_short_sources_trims_and_mute(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            clip=secrets.token_hex(16)
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=purple:s=128x72:r=30:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-f','mp4',str(folder/clip)],check=True)
            info=server.probe_video(folder,{'id':clip})
            self.assertEqual(info['width'],128)
            self.assertTrue(info['hasAudio'])
            self.assertAlmostEqual(info['duration'],3,places=2)
            request={'mode':'join','clips':[{'id':clip,'startFrame':24,'frames':24},{'id':clip,'startFrame':0,'frames':48}],'fps':24,'outputWidth':128,'outputHeight':72,'audio':'keep'}
            result=server.assemble(folder,request)
            streams=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,nb_frames,width,height','-of','json',str(folder/result)]))['streams']
            self.assertEqual(int(next(x for x in streams if x['codec_type']=='video')['nb_frames']),72)
            self.assertTrue(any(x['codec_type']=='audio' for x in streams))
            request['audio']='mute'
            muted=server.assemble(folder,request)
            muted_streams=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type','-of','json',str(folder/muted)]))['streams']
            self.assertFalse(any(x['codec_type']=='audio' for x in muted_streams))
            with self.assertRaises(ValueError):server.join_dimensions({'outputWidth':127,'outputHeight':72})

if __name__=='__main__':unittest.main()
