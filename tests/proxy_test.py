"""Exercise the real same-origin proxy with an isolated fake network renderer."""
import importlib.util
import http.server
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

spec=importlib.util.spec_from_file_location('studio_server',Path(__file__).parents[1]/'studio-server.py')
studio=importlib.util.module_from_spec(spec);spec.loader.exec_module(studio)

class FakeComfy(http.server.BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        body=json.dumps({'queue_running':[],'queue_pending':[]}).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        body=json.dumps({'prompt_id':'test-job','received':data}).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

class ProxyTests(unittest.TestCase):
    def test_fixed_upstream_and_submission_token(self):
        with tempfile.TemporaryDirectory() as folder:
            upstream=http.server.ThreadingHTTPServer(('127.0.0.1',0),FakeComfy)
            local=http.server.ThreadingHTTPServer(('127.0.0.1',0),studio.StudioHandler)
            local.comfy_url=f'http://127.0.0.1:{upstream.server_port}'
            local.token='test-session-token';local.media=Path(folder)
            local.media_lock=threading.Lock();local.assembly_lock=threading.Lock()
            for server in [upstream,local]:threading.Thread(target=server.serve_forever,daemon=True).start()
            base=f'http://127.0.0.1:{local.server_port}'
            try:
                cfg=json.load(urllib.request.urlopen(base+'/api/studio/config'))
                self.assertEqual(cfg['comfyEndpoint'],local.comfy_url)
                queue=json.load(urllib.request.urlopen(base+'/api/comfy/queue'))
                self.assertEqual(queue['queue_running'],[])
                request=urllib.request.Request(base+'/api/comfy/prompt',data=b'{"prompt":{}}',headers={'Content-Type':'application/json','Origin':base},method='POST')
                with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(request)
                self.assertEqual(error.exception.code,403)
                request.add_header('X-Studio-Token',local.token)
                result=json.load(urllib.request.urlopen(request));self.assertEqual(result['prompt_id'],'test-job')
                for path in ['/api/comfy/interrupt','/api/comfy/userdata','/api/comfy/http://example.com']:
                    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(base+path)
                    self.assertEqual(error.exception.code,404)
                evil=urllib.request.Request(base+'/api/studio/config',headers={'Host':'untrusted.example'})
                with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(evil)
                self.assertEqual(error.exception.code,403)
            finally:
                for server in [local,upstream]:server.shutdown();server.server_close()

if __name__=='__main__':unittest.main()
