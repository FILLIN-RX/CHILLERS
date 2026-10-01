import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      version: '1.0.0',
      buildNumber: 1,
      minVersion: '1.0.0',
      apkUrl: 'https://github.com/FILLIN-RX/CHILLERS/releases/latest/download/app-release.apk',
      universalApkUrl: 'https://github.com/FILLIN-RX/CHILLERS/releases/latest/download/app-release.apk',
      arm64ApkUrl: 'https://github.com/FILLIN-RX/CHILLERS/releases/latest/download/app-arm64-v8a-release.apk',
      changelog: 'Nouvelle version de Chillers Mobile avec streaming haute vitesse, téléchargements et transfert P2P/NFC.',
      releaseDate: new Date().toISOString().split('T')[0],
      forceUpdate: false,
    },
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
