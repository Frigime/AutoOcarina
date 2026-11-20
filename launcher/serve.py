import functools
import http.server
import os
import socketserver
import webbrowser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app")

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".uf2": "application/octet-stream",
    }

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass

def main():
    handler = functools.partial(Handler, directory=ROOT)
    for port in range(8765, 8786):
        try:
            server = socketserver.ThreadingTCPServer(("localhost", port), handler)
            break
        except OSError:
            continue
    else:
        raise SystemExit("No free port (8765-8785) / aucun port libre.")
    url = f"http://localhost:{port}/"
    print(f"\n  AutoOcarina is running / est lancé : {url}\n  Open it in Chrome or Edge / ouvre-la dans Chrome ou Edge.\n  Ctrl+C to stop / pour arrêter.\n")
    webbrowser.open(url)
    with server:
        server.serve_forever()

if __name__ == "__main__":
    main()
