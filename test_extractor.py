import sys
import yt_dlp

def search_and_get_download(query_or_url: str, download_now: bool = False):
    # Si c'est déjà une URL directe
    if query_or_url.startswith("http://") or query_or_url.startswith("https://"):
        url = query_or_url
    else:
        # Recherche les 3 premières vidéos sur YouTube
        print(f"\n[🔍] Recherche pour : \"{query_or_url}\"...")
        search_opts = {
            'quiet': True,
            'extract_flat': 'in_playlist',
            'skip_download': True,
        }
        with yt_dlp.YoutubeDL(search_opts) as ydl:
            res = ydl.extract_info(f"ytsearch3:{query_or_url}", download=False)
            entries = res.get('entries', [])
            if not entries:
                print("[-] Aucun résultat trouvé.")
                return
            
            print(f"\n[✓] {len(entries)} résultat(s) trouvé(s) :\n")
            for i, entry in enumerate(entries, 1):
                print(f"[{i}] {entry.get('title')}")
                print(f"    Lien page : https://www.youtube.com/watch?v={entry.get('id')}\n")
            
            # On prend le premier résultat par défaut
            url = f"https://www.youtube.com/watch?v={entries[0].get('id')}"

    print("=" * 60)
    print(f"[+] Analyse et extraction du meilleur lien pour :")
    print(f"    {url}")
    print("=" * 60)

    # Récupération des informations complètes et du lien direct combiné
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=download_now)
            
            print(f"\n🎬 Titre       : {info.get('title')}")
            print(f"⏱  Durée       : {info.get('duration')} secondes")
            print(f"🖼  Miniature   : {info.get('thumbnail')}")
            print(f"📦 Format      : {info.get('resolution')} ({info.get('ext')})")
            
            direct_url = info.get('url')
            if direct_url:
                print(f"\n🔗 LIEN DIRECT DU FLUX VIDÉO / MP4 :")
                print(f"{direct_url}")
            else:
                # Si le format sélectionné a séparé vidéo et audio
                requested_formats = info.get('requested_formats', [])
                if requested_formats:
                    print(f"\n🔗 LIENS DIRECTS DES FLUX :")
                    for rf in requested_formats:
                        type_flux = "Vidéo" if rf.get('vcodec') != 'none' else "Audio"
                        print(f"  • Flux {type_flux} ({rf.get('resolution', rf.get('acodec'))}) :")
                        print(f"    {rf.get('url')}\n")
            
            print("=" * 60)
            if download_now:
                print("[✓] Téléchargement du fichier terminé sur votre disque !")
            else:
                print("[💡] Pour télécharger directement le fichier vidéo (.mp4) sur votre PC, ajoutez l'option '--download' :")
                print(f"    python3 test_extractor.py \"{query_or_url}\" --download")

    except Exception as e:
        print(f"[-] Erreur : {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = sys.argv[1]
        should_download = "--download" in sys.argv
    else:
        query = "Spider-Man Trailer 4k"
        should_download = False

    search_and_get_download(query, should_download)
