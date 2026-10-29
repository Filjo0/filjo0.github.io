"""Local-only portfolio preview with enough backlog for parallel ES-module loads."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[1]

class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

class PreviewHandler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def list_directory(self, path):
        self.send_error(403, 'Directory listing is disabled')
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('Port must be between 1 and 65535')
    handler = partial(PreviewHandler, directory=str(ROOT))
    with PreviewServer(('127.0.0.1', args.port), handler) as server:
        print(f'Portfolio preview: http://127.0.0.1:{args.port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    main()
