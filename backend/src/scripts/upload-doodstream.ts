import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_KEY = process.env.DOODSTREAM_API_KEY;
const BASE_URL = 'https://doodapi.co/api';

const getFilmsPath = (): string => {
  if (process.env.FILMS_PATH) {
    return process.env.FILMS_PATH;
  }
  const localPath = path.join(__dirname, '../../film.json');
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  const scrappingPath = '/home/ruxel/scrapping/film.json';
  if (fs.existsSync(scrappingPath)) {
    return scrappingPath;
  }
  return localPath;
};

const FILMS_PATH = getFilmsPath();
const UPLOADED_PATH = path.join(__dirname, '../../uploaded.json');
const FOLDER_ID = '0';

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function loadUploaded(): Record<string, any> {
  if (fs.existsSync(UPLOADED_PATH)) {
    return JSON.parse(fs.readFileSync(UPLOADED_PATH, 'utf-8'));
  }
  return {};
}

function saveUploaded(data: Record<string, any>) {
  fs.writeFileSync(UPLOADED_PATH, JSON.stringify(data, null, 2));
}

async function uploadToDoodStream(title: string, directUrl: string) {
  const params: Record<string, string> = {
    key: API_KEY!,
    url: directUrl,
    new_title: title,
  };
  if (FOLDER_ID !== '0') params.fld_id = FOLDER_ID;

  const { data } = await axios.get(`${BASE_URL}/upload/url`, { params, timeout: 30000 });
  return data;
}

async function checkFileStatus(fileCode: string) {
  const { data } = await axios.get(`${BASE_URL}/file/check`, {
    params: { key: API_KEY, file_code: fileCode },
    timeout: 15000,
  });
  return data.result?.[0]?.status || 'unknown';
}

async function main() {
  if (!API_KEY) {
    console.error('[ERROR] DOODSTREAM_API_KEY manquant dans .env');
    process.exit(1);
  }

  const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf-8'));
  const uploaded = loadUploaded();

  console.log(`[UPLOAD] ${films.length} films trouvés dans ${FILMS_PATH}`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  const timestamps: number[] = [];
  const RATE_LIMIT = 9;
  const TIME_WINDOW = 1000;

  for (const film of films) {
    const { titre, lien, tmdbId, year } = film;
    const key = titre.toLowerCase().trim();

    if (uploaded[key]) {
      console.log(`[SKIP] ${titre} — déjà uploadé (code: ${uploaded[key].fileCode})`);
      skipped++;
      continue;
    }

    // Rate limiting: enforce max 9 uploads per second
    const now = Date.now();
    // Remove timestamps older than 1s
    while (timestamps.length > 0 && timestamps[0] <= now - TIME_WINDOW) {
      timestamps.shift();
    }

    if (timestamps.length >= RATE_LIMIT) {
      const waitTime = timestamps[0] + TIME_WINDOW - now;
      console.log(`[RATE] Limite atteinte, attente de ${Math.round(waitTime)}ms...`);
      await sleep(waitTime);
    }

    console.log(`[UPLOAD] ${titre}...`);

    try {
      const result = await uploadToDoodStream(titre, lien);
      timestamps.push(Date.now());

      if (result.status === 200) {
        const fileCode = result.result.filecode;
        uploaded[key] = {
          titre,
          fileCode,
          lien,
          tmdbId: tmdbId || null,
          year: year || null,
          totalSlots: result.total_slots,
          usedSlots: result.used_slots,
          uploadedAt: new Date().toISOString(),
        };
        saveUploaded(uploaded);
        console.log(`[OK] ${titre} → fileCode: ${fileCode}`);
        success++;
      } else {
        console.error(`[FAIL] ${titre} — status ${result.status}: ${result.msg}`);
        failed++;
      }
    } catch (err: any) {
      const msg = err.response?.data?.msg || err.message;
      console.error(`[FAIL] ${titre} — ${msg}`);
      failed++;
    }
  }

  console.log(`\n[DONE] ${success} uploadés, ${skipped} déjà faits, ${failed} échoués`);
  console.log(`[FILE] ${UPLOADED_PATH}`);
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
