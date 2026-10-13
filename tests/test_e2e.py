import json
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
import urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class E2E(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.start()
    def start(self):
        self.proc=subprocess.Popen([sys.executable,str(ROOT/'app.py'),'--port','0','--db',self.tmp.name+'/db.sqlite3'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
        self.url=self.proc.stdout.readline().strip().split()[-1]
    def tearDown(self):
        self.proc.terminate();self.proc.wait(timeout=5);self.proc.stdout.close();self.tmp.cleanup()
    def request(self,path,data=None,origin=None):
        headers={'Content-Type':'application/json'}
        if origin:headers['Origin']=origin
        req=urllib.request.Request(self.url+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
        with urllib.request.urlopen(req,timeout=3) as r:return r.status,json.loads(r.read())
    def test_http_analysis_and_assets(self):
        for s in ['BTC','ETH','SOL']:
            status,data=self.request('/api/analysis?symbol='+s)
            self.assertEqual(status,200);self.assertEqual(len(data['prices']),90);self.assertEqual(data['source'],'synthetic_fixture');self.assertLess(data['max_drawdown_pct'],0)
        with self.assertRaises(urllib.error.HTTPError) as e:self.request('/api/analysis?symbol=FAKE')
        self.assertEqual(e.exception.code,400)
    def test_real_persistence_after_restart(self):
        self.request('/api/posts',{'author':'Test researcher','body':"<script>alert('x')</script>"})
        self.proc.terminate();self.proc.wait(timeout=5);self.proc.stdout.close();self.start()
        _,data=self.request('/api/posts');self.assertEqual(data['items'][0]['body'],"<script>alert('x')</script>")
    def test_validation_and_origin(self):
        for data in [{'author':'','body':'x'},{'author':'a','body':4},[],{'author':'a','body':'x'*2001}]:
            with self.assertRaises(urllib.error.HTTPError) as e:self.request('/api/posts',data)
            self.assertEqual(e.exception.code,400)
        with self.assertRaises(urllib.error.HTTPError) as e:self.request('/api/posts',{'author':'a','body':'x'},origin='https://evil.example')
        self.assertEqual(e.exception.code,403)
        self.assertEqual(self.request('/api/posts')[1]['items'],[])
    def test_routes_and_static_content(self):
        for path,mime in [('/','text/html'),('/app.js','text/javascript'),('/style.css','text/css')]:
            with urllib.request.urlopen(self.url+path) as r:
                self.assertEqual(r.status,200);self.assertIn(mime,r.headers['Content-Type']);self.assertIn("script-src 'self'",r.headers['Content-Security-Policy'])
        with self.assertRaises(urllib.error.HTTPError) as e:self.request('/../../app.py')
        self.assertEqual(e.exception.code,404)

if __name__=='__main__':unittest.main()
