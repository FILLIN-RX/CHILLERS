import os
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import yt_dlp

PORT = 8080

class VideoExtractorHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Route API : /api/search?q=...
        if parsed_path.path == "/api/search":
            query_params = urllib.parse.parse_qs(parsed_path.query)
            query = query_params.get("q", [""])[0].strip()
            
            if not query:
                self.send_json_response({"error": "Veuillez entrer un titre ou une URL."}, 400)
                return
            
            try:
                results = self.extract_videos(query)
                self.send_json_response(results, 200)
            except Exception as e:
                self.send_json_response({"error": str(e)}, 500)
            return

        # Route par défaut : servir index.html
        if parsed_path.path == "/" or parsed_path.path == "":
            self.path = "/index.html"
            
        return super().do_GET()

    def send_json_response(self, data, status=200):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def extract_videos(self, query: str):
        is_url = query.startswith("http://") or query.startswith("https://")
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        
        videos = []
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            if is_url:
                info = ydl.extract_info(query, download=False)
                entries = [info]
            else:
                search_res = ydl.extract_info(f"ytsearch5:{query}", download=False)
                entries = search_res.get("entries", [])

            for entry in entries:
                if not entry:
                    continue
                
                # Extraction des résolutions / formats
                formats = []
                seen_res = set()
                raw_formats = entry.get("formats", [])
                
                for f in raw_formats:
                    res = f.get("resolution") or f"{f.get('height', '')}p" if f.get('height') else None
                    url = f.get("url")
                    ext = f.get("ext")
                    vcodec = f.get("vcodec", "none")
                    acodec = f.get("acodec", "none")
                    
                    if url and res and res not in seen_res and vcodec != "none":
                        seen_res.add(res)
                        filesize = f.get("filesize") or f.get("filesize_approx")
                        size_str = f"{filesize / (1024*1024):.1f} Mo" if filesize else "N/A"
                        
                        formats.append({
                            "resolution": res,
                            "ext": ext,
                            "has_audio": acodec != "none",
                            "size": size_str,
                            "download_url": url
                        })

                # Si aucun format filtré, fallback vers l'URL principale
                if not formats and entry.get("url"):
                    formats.append({
                        "resolution": "Standard",
                        "ext": entry.get("ext", "mp4"),
                        "has_audio": True,
                        "size": "N/A",
                        "download_url": entry.get("url")
                    })

                videos.append({
                    "title": entry.get("title", "Sans titre"),
                    "thumbnail": entry.get("thumbnail"),
                    "duration": entry.get("duration", 0),
                    "uploader": entry.get("uploader", "Inconnu"),
                    "page_url": entry.get("webpage_url") or entry.get("url"),
                    "formats": formats
                })

        return {"query": query, "count": len(videos), "results": videos}

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, VideoExtractorHandler)
    print(f"\n========================================================")
    print(f"🚀 Serveur Web prêt sur : http://localhost:{PORT}")
    print(f"👉 Ouvrez cette adresse dans votre navigateur pour tester !")
    print(f"========================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
