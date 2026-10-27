"""Verify discovery/chat relay, authentication and destination boundaries."""
import http.server
import importlib.util
import json
from pathlib import Path
import threading
import unittest
import urllib.request
import urllib.error

spec=importlib.util.spec_from_file_location('studio',Path(__file__).parents[1]/'studio-server.py')
studio=importlib.util.module_from_spec(spec);spec.loader.exec_module(studio)

class FakeAI(http.server.BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def send_json(self,code,data):
        body=json.dumps(data).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_GET(self):
        if self.headers.get('Authorization')!='Bearer test-key':return self.send_json(401,{'error':{'message':'Unauthorized'}})
        self.send_json(200,{'data':[{'id':'local-model'}]})
    def do_POST(self):
        if self.headers.get('Authorization')!='Bearer test-key':return self.send_json(401,{'error':{'message':'Unauthorized'}})
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        assert data['stream'] is False
        self.send_json(200,{'choices':[{'message':{'content':'connected'}}]})

class AIProxyTests(unittest.TestCase):
    def test_models_chat_and_auth(self):
        upstream=http.server.ThreadingHTTPServer(('127.0.0.1',0),FakeAI)
        local=http.server.ThreadingHTTPServer(('127.0.0.1',0),studio.StudioHandler);local.token='test-token'
        for server in [upstream,local]:threading.Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{local.server_port}'
        def call(data,token=True):
            headers={'Content-Type':'application/json','Origin':base}
            if token:headers['X-Studio-Token']=local.token
            return json.load(urllib.request.urlopen(urllib.request.Request(base+'/api/ai/request',data=json.dumps(data).encode(),headers=headers)))
        config={'endpoint':f'http://127.0.0.1:{upstream.server_port}/v1','route':'models','apiKey':'test-key'}
        try:
            self.assertEqual(call(config)['data'][0]['id'],'local-model')
            self.assertEqual(call({**config,'route':'chat/completions','payload':{'model':'local-model','messages':[{'role':'user','content':'hello'}]}})['choices'][0]['message']['content'],'connected')
            for value,code in [({**config,'apiKey':''},401),({**config,'endpoint':'http://169.254.169.254'},400),({**config,'route':'admin'},400),({**config,'endpoint':'http://example.com/v1'},400)]:
                with self.assertRaises(urllib.error.HTTPError) as error:call(value)
                self.assertEqual(error.exception.code,code)
            with self.assertRaises(urllib.error.HTTPError) as error:call(config,False)
            self.assertEqual(error.exception.code,403)
        finally:
            for server in [local,upstream]:server.shutdown();server.server_close()
    def test_endpoint_credentials_and_invalid_routes(self):
        for endpoint in ['http://user:pass@127.0.0.1/v1','file:///tmp/private','http://127.0.0.1/v1?x=y','http://127.0.0.1/v1#fragment',None]:
            with self.assertRaises(ValueError):studio.ai_target(endpoint,'models')

if __name__=='__main__':unittest.main()
