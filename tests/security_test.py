"""Regression tests for public-file isolation and local relay boundaries."""
import contextlib
import http.server
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error

spec = importlib.util.spec_from_file_location('studio_security', Path(__file__).parents[1] / 'studio-server.py')
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)

class QuietStudio(studio.StudioHandler):
    def log_message(self, *args): pass

@contextlib.contextmanager
def running(handler):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    server.token = 'synthetic-test-token'
    server.comfy_url = ''
    with tempfile.TemporaryDirectory() as media:
        server.media = Path(media)
        server.media_lock = threading.Lock()
        server.assembly_lock = threading.Lock()
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            yield server, f'http://127.0.0.1:{server.server_port}'
        finally:
            server.shutdown()
            server.server_close()

class SecurityTests(unittest.TestCase):
    def response(self, url, method='GET', headers=None):
        request = urllib.request.Request(url, method=method, headers=headers or {})
        try:
            return urllib.request.urlopen(request, timeout=5)
        except urllib.error.HTTPError as error:
            return error

    def test_private_files_paths_listings_symlinks_and_head(self):
        previous = studio.ROOT
        with tempfile.TemporaryDirectory() as temp:
            studio.ROOT = Path(temp)
            try:
                (studio.ROOT/'index.html').write_text('<!doctype html><title>Demo</title>')
                (studio.ROOT/'shared-productions.json').write_text('PRIVATE_SENTINEL')
                (studio.ROOT/'.git').mkdir()
                (studio.ROOT/'.git/config').write_text('PRIVATE_SENTINEL')
                (studio.ROOT/'artifacts').mkdir()
                (studio.ROOT/'artifacts/private.txt').write_text('PRIVATE_SENTINEL')
                # Even an allowlisted filename must not be a symlink to private data.
                (studio.ROOT/'script.js').symlink_to(studio.ROOT/'shared-productions.json')
                with running(QuietStudio) as (server, base):
                    for path in ['/shared-productions.json', '/.git/config', '/artifacts/', '/artifacts/private.txt', '/studio-server.py', '/script.js', '/%2e%2e/shared-productions.json', '/tests/', '/workflows/']:
                        for method in ['GET', 'HEAD']:
                            with self.response(base+path, method) as response:
                                self.assertEqual(response.status, 404, (path, method))
                                self.assertNotIn(b'PRIVATE_SENTINEL', response.read())
                    for method in ['GET', 'HEAD']:
                        with self.response(base+'/', method) as response:
                            self.assertEqual(response.status, 200)
                            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
                            self.assertIn("script-src 'self'", response.headers['Content-Security-Policy'])
                            self.assertEqual(response.headers['Cache-Control'], 'no-store')
                            self.assertEqual(response.read(), b'' if method=='HEAD' else b'<!doctype html><title>Demo</title>')
                    with self.response(base+'/api/studio/config', 'HEAD') as response:
                        self.assertEqual(response.status, 405)
            finally:
                studio.ROOT = previous

    def test_cross_site_reads_and_dns_rebinding_blocked(self):
        with running(QuietStudio) as (server, base):
            for method in ['GET', 'HEAD']:
                for headers in [{'Host':'attacker.invalid'}, {'Sec-Fetch-Site':'cross-site'}, {'Sec-Fetch-Site':'same-site'}]:
                    with self.response(base+'/api/studio/config', method, headers) as response:
                        self.assertEqual(response.status, 403)
                        self.assertNotIn(server.token.encode(), response.read())
            with self.response(base+'/api/studio/config', headers={'Sec-Fetch-Site':'same-origin'}) as response:
                self.assertEqual(json.load(response)['token'], server.token)

    def test_comfy_redirects_and_active_content_do_not_escape_proxy(self):
        hits=[]
        class Upstream(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                hits.append(self.path)
                if self.path=='/queue':
                    self.send_response(302)
                    self.send_header('Location', self.server.destination)
                    self.end_headers()
                else:
                    self.send_response(200)
                    self.send_header('Content-Type','text/html')
                    self.end_headers()
                    self.wfile.write(b'<script>alert("untrusted")</script>')
        with running(Upstream) as (upstream, origin), running(QuietStudio) as (server, base):
            upstream.destination=origin+'/redirect-target'
            server.comfy_url=origin
            with self.response(base+'/api/comfy/queue') as response:
                self.assertEqual(response.status,302)
                self.assertEqual(response.headers['Content-Type'],'application/json')
            self.assertEqual(hits,['/queue'])
            with self.response(base+'/api/comfy/view?filename=unsafe.html') as response:
                self.assertEqual(response.status,502)
                self.assertNotIn(b'<script>',response.read())

    def test_uploaded_playlists_cannot_fetch_network_resources(self):
        hits=[]
        class Target(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                hits.append(self.path)
                self.send_response(404);self.end_headers()
        with running(Target) as (_, base), tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            token='a'*32
            (folder/token).write_text('#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\n'+base+'/private-segment.ts\n#EXT-X-ENDLIST\n')
            with self.assertRaisesRegex(ValueError, 'readable video'):
                studio.probe_video(folder, {'id':token})
            with self.assertRaisesRegex(ValueError, 'no frame'):
                studio.extract_frame(folder, {'id':token,'frames':120})
            self.assertEqual(hits,[])

    def test_invalid_content_length_returns_json_instead_of_handler_crash(self):
        with running(QuietStudio) as (server, base):
            request=urllib.request.Request(base+'/api/ai/request', data=b'{}', headers={'Origin':base,'X-Studio-Token':server.token,'Content-Length':'invalid'},method='POST')
            with self.assertRaises(urllib.error.HTTPError) as result:
                urllib.request.urlopen(request,timeout=5)
            with result.exception as response:
                self.assertEqual(response.status,400)
                self.assertIn('error',json.load(response))

if __name__ == '__main__': unittest.main()
