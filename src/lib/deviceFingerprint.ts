"use client";

/**
 * Génère une empreinte stable de l'appareil matériel (Browser Hardware Fingerprint)
 * basée sur les caractéristiques stables de la machine :
 * - Plateforme & OS
 * - Résolution d'écran physique
 * - Fuseau horaire
 * - Nombre de cœurs CPU (hardwareConcurrency)
 * - Mémoire appareil (deviceMemory)
 * - Langue
 * 
 * Ainsi, 2 fenêtres, 2 onglets ou même 2 navigateurs différents sur le MÊME ordinateur
 * ou téléphone sont reconnus comme UN SEUL et MÊME appareil physique !
 */
export function getStableDeviceFingerprint(): { deviceId: string; deviceName: string } {
  if (typeof window === "undefined") {
    return { deviceId: "server-device", deviceName: "Serveur" };
  }

  // 1. Vérifier si un ID a déjà été généré et stocké dans localStorage
  const LOCAL_KEY = "chillers_stable_device_id";
  try {
    const existing = localStorage.getItem(LOCAL_KEY);
    if (existing) {
      return {
        deviceId: existing,
        deviceName: getReadableDeviceName(),
      };
    }
  } catch {}

  // 2. Extraire les signatures matérielles
  const screenRes = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const nav = window.navigator as any;
  const cores = nav.hardwareConcurrency || 2;
  const memory = nav.deviceMemory || 4;
  const platform = nav.userAgentData?.platform || nav.platform || "";
  const lang = nav.language || "";

  // 3. Parser un nom lisible d'appareil (ex: "Windows PC", "MacBook", "iPhone", "Android")
  const deviceName = getReadableDeviceName();

  // 4. Hash stable des attributs matériels
  const rawFingerprint = `${platform}-${screenRes}-${timeZone}-${cores}-${memory}-${lang}`;
  let hash = 0;
  for (let i = 0; i < rawFingerprint.length; i++) {
    const char = rawFingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  const safeHash = Math.abs(hash).toString(36);
  const cleanPlatform = platform.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "dev";
  const deviceId = `dev_${cleanPlatform}_${safeHash}`;

  try {
    localStorage.setItem(LOCAL_KEY, deviceId);
  } catch {}

  return { deviceId, deviceName };
}

/**
 * Nom lisible et propre de l'appareil (plutôt que le long user-agent brut)
 */
export function getReadableDeviceName(): string {
  if (typeof window === "undefined") return "Appareil";

  const ua = window.navigator.userAgent;

  let os = "Appareil inconnu";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "Mac";
  else if (/Windows NT/i.test(ua)) os = "PC Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Navigateur";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome|CriOS/i.test(ua)) browser = "Chrome";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";

  return `${os} · ${browser}`;
}
