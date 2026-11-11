"""Serve the Next.js export with its 404 document and an unblocked local geo response."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlsplit(self.path).path == "/api/geo":
            self.respond(200, "application/json", b'{"blocked":false}')
        else:
            super().do_GET()

    def respond(self, code, content_type, body):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error(self, code, message=None, explain=None):
        if code == 404 and self.headers.get("Sec-Fetch-Dest") == "document":
            path = Path("404.html")
            if path.exists():
                self.respond(404, "text/html; charset=utf-8", path.read_bytes())
                return
        super().send_error(code, message, explain)


parser = argparse.ArgumentParser()
parser.add_argument("port", type=int)
port = parser.parse_args().port
with ThreadingHTTPServer(("127.0.0.1", port), Handler) as server:
    print("Serving HTTP", flush=True)
    server.serve_forever()
