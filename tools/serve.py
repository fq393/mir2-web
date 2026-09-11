"""Loopback-only static Web build server; revalidate cached assets so rebuilds remain visible."""
import http.server
import json
import logging
from logging.handlers import RotatingFileHandler
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
(ROOT / '.runtime').mkdir(exist_ok=True)
LOGGER = logging.getLogger('mir2.web')
LOGGER.propagate = False
LOGGER.setLevel(logging.INFO)
if not LOGGER.handlers:
    handler = RotatingFileHandler(ROOT / '.runtime/web-access.log', maxBytes=2_000_000, backupCount=3, encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
    LOGGER.addHandler(handler)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'build/web'), **kwargs)

    def log_message(self, format, *args):
        # SimpleHTTPRequestHandler logs before sending headers. A detached launcher's
        # closed stderr pipe must not turn a valid response into an empty reply.
        try:
            LOGGER.info('%s %s', self.address_string(), (format % args).replace('\n', r'\n').replace('\r', r'\r'))
        except OSError:
            pass

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
