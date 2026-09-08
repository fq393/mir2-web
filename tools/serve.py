"""Loopback-only static Web build server; revalidate cached assets so rebuilds remain visible."""
import http.server
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'build/web'), **kwargs)

    def do_GET(self):
        if self.path == '/__mir2_health':
            data = json.dumps({'project': 'mir2-web', 'root': str(ROOT), 'webBuild': (ROOT / 'build/web/index.html').is_file()}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    if not (ROOT / 'build/web/index.html').is_file():
        raise SystemExit('Missing Web build. Run bash tools/build-web.sh')
    print('Mir2 web: http://127.0.0.1:17600', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', 17600), Handler).serve_forever()
