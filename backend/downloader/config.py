import os
import tempfile

# ── Sources ─────────────────────────────────────────────────────
VIDLINK_BASE = "https://vidlink.pro/embed"
VIDAPI_BASE = "https://vidapi.xyz/embed"

# ── Timeouts ────────────────────────────────────────────────────
EXTRACTION_TIMEOUT = 30          # secondes max par tentative d'extraction
BROWSER_LAUNCH_TIMEOUT = 15      # secondes pour lancer le navigateur
DOWNLOAD_TIMEOUT = 600           # 10 minutes max pour un téléchargement FFmpeg
NAVIGATION_TIMEOUT = 25          # secondes max pour charger la page

# ── Chemins ─────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(os.path.dirname(BASE_DIR), "downloads")
os.makedirs(STORAGE_DIR, exist_ok=True)

FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "ffmpeg")

# ── Concurrence ─────────────────────────────────────────────────
MAX_CONCURRENT_DOWNLOADS = 2

# ── Bloqueur publicitaire ───────────────────────────────────────
ADBLOCK_PATTERNS = [
    "popads", "exoclick", "doubleclick", "googleadservices",
    "googlesyndication", "adservice", "adserver", "advertising",
    "advert", "adfox", "adriver", "adult", "analytics",
    "banner", "bidder", "buysellads", "cpm", "criteo",
    "domaincontrol", "exponential", "fastclick", "indexexchange",
    "mads", "media.net", "moatads", "openx", "optimizely",
    "outbrain", "pubmatic", "pusher", "rubicon", "scorecardresearch",
    "sessioncam", "sharethrough", "skimlinks", "taboola",
    "teads", "tremorhub", "tribalfusion", "usemaxserver",
    "valueclick", "yieldlab", "yieldmo", "yieldtraffic",
    "zergnet", "adpia", "adnxs", "adsrvr", "adzerk",
    "appnexus", "casalemedia", "contextweb", "convertro",
    "demdex", "exelate", "eyeota", "google", "improvedigital",
    "krxd", "millennialmedia", "mookie1", "pidgets",
    "pubnub", "quantserve", "rlcdn", "rlcl", "segapi",
    "serving-sys", "simpli", "spotxchange", "tabmo",
    "tidaltv", "turn", "twimg", "w55c", "xiti",
]
