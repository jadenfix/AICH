"""Local cryptocurrency research workspace; deterministic fixture data, no trades."""
import argparse
import json
import math
import sqlite3
import statistics
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).parent
ASSETS = {'BTC': 64000, 'ETH': 3200, 'SOL': 140}


def history(symbol):
    base = ASSETS[symbol]
    return [round(base * math.exp(.0015*i + .045*math.sin(i/4) + .015*math.cos(i/2)), 2) for i in range(90)]


def analysis(symbol):
    prices = history(symbol)
    returns = [math.log(b/a) for a,b in zip(prices, prices[1:])]
    peak = prices[0]
    drawdown = 0
    for p in prices:
        peak = max(peak, p)
        drawdown = min(drawdown, p/peak-1)
    return dict(symbol=symbol, source='synthetic_fixture', as_of='2025-01-01', prices=prices,
                return_pct=round((prices[-1]/prices[0]-1)*100,2),
                annualized_volatility_pct=round(statistics.stdev(returns)*math.sqrt(365)*100,2),
                max_drawdown_pct=round(drawdown*100,2),
                methodology='90 synthetic daily closes; log-return sample volatility, 365-day annualization, peak-to-trough drawdown. No prediction model or live feed.')


def connect(db):
    conn = sqlite3.connect(db)
    conn.execute('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)')
    conn.commit()
    return conn


def handler(db):
    class Handler(BaseHTTPRequestHandler):
        def send(self, status, payload, content_type='application/json'):
            body = json.dumps(payload).encode() if content_type == 'application/json' else payload
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            if path == '/api/health':
                return self.send(200, {'ok': True, 'mode': 'local_fixture'})
            if path == '/api/analysis':
                symbol = parse_qs(parsed.query).get('symbol', ['BTC'])[0].upper()
                if symbol not in ASSETS:
                    return self.send(400, {'error':'Supported assets: BTC, ETH, SOL'})
                return self.send(200, analysis(symbol))
            if path == '/api/news':
                return self.send(200, {'source':'synthetic_fixture','items':[
                    {'title':'Research note: volatility and drawdown measure different risks', 'body':'Compare daily log-return variation with the worst decline from a running peak.'},
                    {'title':'Before interpreting any backtest', 'body':'Check time splits, trading fees, slippage, leakage and data provenance.'}]})
            if path == '/api/posts':
                with connect(db) as conn:
                    rows = conn.execute('SELECT id,author,body,created_at FROM posts ORDER BY id DESC LIMIT 100').fetchall()
                return self.send(200, {'items':[dict(zip(['id','author','body','created_at'],row)) for row in rows]})
            files = {'/':('index.html','text/html; charset=utf-8'),'/app.js':('app.js','text/javascript; charset=utf-8'),'/style.css':('style.css','text/css; charset=utf-8')}
            if path in files:
                name,mime = files[path]
                return self.send(200,(ROOT/'static'/name).read_bytes(),mime)
            return self.send(404, {'error':'Not found'})

        def do_POST(self):
            if self.path != '/api/posts':
                return self.send(404, {'error':'Not found'})
            # Local workspace has no authentication; prevent cross-origin browser writes.
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + self.headers.get('Host',''):
                return self.send(403, {'error':'Cross-origin writes are disabled'})
            try:
                size = int(self.headers.get('Content-Length','0'))
                if size <= 0 or size > 8192:
                    return self.send(413, {'error':'Body must be 1–8192 bytes'})
                if self.headers.get('Content-Type','').split(';')[0] != 'application/json':
                    return self.send(415, {'error':'Expected application/json'})
                data = json.loads(self.rfile.read(size))
                if not isinstance(data,dict):
                    raise ValueError('Expected JSON object')
                author,body = data.get('author'),data.get('body')
                if not isinstance(author,str) or not isinstance(body,str):
                    raise ValueError('Author and body must be text')
                author,body = author.strip(),body.strip()
                if not 1 <= len(author) <= 80 or not 1 <= len(body) <= 2000:
                    raise ValueError('Author: 1–80 characters; note: 1–2000 characters')
            except (ValueError, json.JSONDecodeError) as exc:
                return self.send(400, {'error':str(exc)})
            with connect(db) as conn:
                cur = conn.execute('INSERT INTO posts(author,body,created_at) VALUES(?,?,?)', (author,body,datetime.now(timezone.utc).isoformat()))
            return self.send(201, {'id':cur.lastrowid})
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--db', default=str(ROOT/'workspace.sqlite3'))
    args = parser.parse_args()
    with connect(args.db):
        pass
    server = ThreadingHTTPServer(('127.0.0.1',args.port),handler(args.db))
    print(f'AICH local fixture workspace: http://127.0.0.1:{server.server_port}',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
