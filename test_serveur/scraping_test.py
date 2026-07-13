import time
import json
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

def scraper_indetectable():
    print("=== Lancement du Navigateur Indétectable (Contournement Cloudflare) ===")
    
    options = uc.ChromeOptions()
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")
    
    # Activation de la capture réseau de Chrome via les DevTools
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    print("Initialisation de Chrome anti-détection...")
    driver = uc.Chrome(options=options)

    try:
        direct_url = "https://vidapi.xyz/embed/movie/tt34888871"
        print(f"Navigation masquée vers : {direct_url}")
        driver.get(direct_url)
        
        print("\n[INFO] Le navigateur est prêt.")
        print("Si un captcha Cloudflare ('Vérifier que vous êtes humain') apparaît :")
        print("-> Cochez la case manuellement dans la fenêtre Chrome.")
        print("\nUne fois sur le lecteur :")
        print("-> 1. Cliquez sur le bouton PLAY.")
        print("-> 2. Fermez immédiatement les fenêtres de pub qui s'ouvrent.")
        print("-> 3. Laissez le film tourner un instant.")
        
        print("\n=== ÉCOUTE RÉSEAU EN TEMPS RÉEL (Pendant 45 secondes) ===")
        print("Le script va capturer les flux au moment exact où vous cliquerez sur Play...\n")
        
        flux_trouves = set()
        requetes_suspectes = set()
        
        # On passe d'un blocage passif à une écoute active
        temps_max = 45  # Augmenté à 45s pour vous laisser le temps de gérer les pubs
        start_time = time.time()
        
        while time.time() - start_time < temps_max:
            try:
                # Récupère les nouveaux logs accumulés depuis le dernier appel
                logs = driver.get_log("performance")
                
                for entry in logs:
                    log_data = json.loads(entry["message"])["message"]
                    
                    if log_data["method"] == "Network.requestWillBeSent":
                        url = log_data["params"]["request"]["url"]
                        url_lower = url.lower()
                        
                        # 1. Recherche des formats de streaming direct
                        # Ajout de .mpd, .m4s, manifest pour couvrir le DASH et HLS
                        if any(ext in url_lower for ext in [".m3u8", ".mp4", ".mpd", "playlist", "master", "manifest"]):
                            # On évite les fragments .ts isolés pour ne pas polluer l'écran
                            if ".ts" not in url_lower and ".m4s" not in url_lower:
                                if url not in flux_trouves:
                                    flux_trouves.add(url)
                                    print(f"🎯 [FLUX VIDÉO INTERCEPTÉ] : {url}")
                                    print("-" * 50)
                        
                        # 2. Collecte des requêtes d'API suspectes (au cas où le flux est masqué derrière une route)
                        elif any(k in url_lower for k in ["api/source", "vapi", "stream", "pass", "token"]):
                            if not any(ex in url_lower for ex in [".js", ".css", ".png", ".jpg", ".svg", ".woff"]):
                                if url not in requetes_suspectes:
                                    requetes_suspectes.add(url)
                                    
            except Exception as e:
                # Évite de faire planter la boucle si les logs ont un soucis temporaire
                pass
                
            time.sleep(1)  # On vérifie le trafic toutes les secondes

        print("\n=== FIN DE LA PÉRIODE D'ANALYSE ===")
        
        # Si rien n'a été trouvé en direct, on affiche ce qui a été intercepté en requêtes secondaires
        if not flux_trouves:
            print("\n❌ Aucun lien de flux direct (.m3u8/.mp4) détecté.")
            if requetes_suspectes:
                print("\n🔍 Cependant, voici les requêtes API/Sources suspectes trouvées :")
                for url in requetes_suspectes:
                    print(f" -> {url}")
            else:
                print("\nAucune requête réseau suspecte n'a pu être capturée. Recommencez en vous assurant que la vidéo s'est bien lancée.")

    except Exception as e:
        print(f"Erreur durant l'exécution : {e}")
    finally:
        driver.quit()
        print("\nNavigateur fermé proprement.")

if __name__ == "__main__":
    scraper_indetectable()