const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../scrapper/.env') });

const LIVE_SEED = [
  // ── Sports (Priorité #1) ────────────────────────────────────────────────
  {
    name: 'beIN SPORTS XTRA',
    slug: 'bein-sports-xtra',
    categories: ['sports'],
    country: 'US',
    language: 'fra',
    type: 'hls',
    streamUrl: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png',
    enabled: true,
    order: 1,
    isOnline: true,
  },
  {
    name: 'beIN SPORTS XTRA HD',
    slug: 'bein-sports-xtra-hd',
    categories: ['sports'],
    country: 'US',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://bein-xtra-samsungus.amagi.tv/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png',
    enabled: true,
    order: 2,
    isOnline: true,
  },
  {
    name: 'Red Bull TV (Sports & Action)',
    slug: 'red-bull-tv',
    categories: ['sports'],
    country: 'FR',
    language: 'fra',
    type: 'hls',
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Red_Bull_logo.svg/512px-Red_Bull_logo.svg.png',
    enabled: true,
    order: 3,
    isOnline: true,
  },
  {
    name: 'Fight Sports HD',
    slug: 'fight-sports-hd',
    categories: ['sports'],
    country: 'US',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://amg01644-anthem-fntv-samsungus-o2tce.amagi.tv/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Fight_Network_logo.svg/512px-Fight_Network_logo.svg.png',
    enabled: true,
    order: 4,
    isOnline: true,
  },
  {
    name: 'World Poker Tour',
    slug: 'world-poker-tour',
    categories: ['sports', 'entertainment'],
    country: 'US',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://amg00778-amg00778c1-wpt-samsungus-1863.playout.now3.amagi.tv/playlist/amg00778-worldpokertour-wpt-samsungus/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/91/World_Poker_Tour_logo.svg/512px-World_Poker_Tour_logo.svg.png',
    enabled: true,
    order: 5,
    isOnline: true,
  },
  // ── France & Généraliste ──────────────────────────────────────────────────
  {
    name: 'France 24 Français',
    slug: 'france-24-francais',
    categories: ['news'],
    country: 'FR',
    language: 'fra',
    type: 'hls',
    streamUrl: 'https://static.france24.com/live/F24_FR_LO_HLS/live_web.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/France_24_logo.svg/512px-France_24_logo.svg.png',
    enabled: true,
    order: 6,
    isOnline: true,
  },
  {
    name: 'TV5MONDE Europe',
    slug: 'tv5monde-europe',
    categories: ['general'],
    country: 'FR',
    language: 'fra',
    type: 'hls',
    streamUrl: 'https://ott.tv5monde.com/Content/HLS/Live/channel(fbs)/variant.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/TV5MONDE_logo.svg/512px-TV5MONDE_logo.svg.png',
    enabled: true,
    order: 7,
    isOnline: true,
  },
  {
    name: 'Euronews Français',
    slug: 'euronews-francais',
    categories: ['news'],
    country: 'FR',
    language: 'fra',
    type: 'hls',
    streamUrl: 'https://2f6c5bf4.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmxheHhUVi1ldV9FdXJvbmV3c0ZyYW5jYWlzX0hMUw/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Euronews_2016_logo.svg/512px-Euronews_2016_logo.svg.png',
    enabled: true,
    order: 8,
    isOnline: true,
  },
  {
    name: 'LCP Assemblée nationale',
    slug: 'lcp-assemblee-nationale',
    categories: ['politics'],
    country: 'FR',
    language: 'fra',
    type: 'hls',
    streamUrl: 'https://stream.lcp.fr/lcp-direct/live/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/LCP_logo.svg/500px-LCP_logo.svg.png',
    enabled: true,
    order: 9,
    isOnline: true,
  },
  {
    name: 'Public Sénat',
    slug: 'public-senat',
    categories: ['politics'],
    country: 'FR',
    language: 'fra',
    type: 'hls',
    streamUrl: 'https://fms-publicsenat.yacast.fr/senat-public/live.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/fr/thumb/5/52/Logo_Public_S%C3%A9nat_2019.svg/512px-Logo_Public_S%C3%A9nat_2019.svg.png',
    enabled: true,
    order: 10,
    isOnline: true,
  },
  // ── International ───────────────────────────────────────────────────────
  {
    name: 'Sky News',
    slug: 'sky-news',
    categories: ['news'],
    country: 'UK',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://jmp2.uk/plu-55b285cd2665de274553d66f.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Sky_News_logo_2018.svg/512px-Sky_News_logo_2018.svg.png',
    enabled: true,
    order: 11,
    isOnline: true,
  },
  {
    name: 'Bloomberg Originals',
    slug: 'bloomberg-originals',
    categories: ['business', 'documentary'],
    country: 'US',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://86fdc85a.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfQmxvb21iZXJnT3JpZ2luYWxzX0hMUw/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Bloomberg_Television_logo.svg/512px-Bloomberg_Television_logo.svg.png',
    enabled: true,
    order: 12,
    isOnline: true,
  },
  {
    name: 'DW English',
    slug: 'dw-english',
    categories: ['news'],
    country: 'DE',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://amg01644-amg01644c1-amgplt0343.playout.now3.amagi.tv/ts-eu-w1-n2/playlist/amg01644-amg01644c1-amgplt0343/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_logo.svg/512px-Deutsche_Welle_logo.svg.png',
    enabled: true,
    order: 13,
    isOnline: true,
  },
  {
    name: 'NHK World Japan',
    slug: 'nhk-world-japan',
    categories: ['news'],
    country: 'JP',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/NHK_World_Japan_2020.svg/512px-NHK_World_Japan_2020.svg.png',
    enabled: true,
    order: 14,
    isOnline: true,
  },
  {
    name: 'Al Jazeera English',
    slug: 'al-jazeera-english',
    categories: ['news'],
    country: 'QA',
    language: 'eng',
    type: 'hls',
    streamUrl: 'https://live-hls-web-aje.getaj.net/AJE.m3u8',
    referer: 'https://www.aljazeera.net/',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/512px-Al_Jazeera_English_logo.svg.png',
    enabled: true,
    order: 15,
    isOnline: true,
  },
];

const LiveChannelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  logo: { type: String, default: '' },
  categories: { type: [String], default: [] },
  country: { type: String, default: 'FR' },
  language: { type: String, default: 'fra' },
  type: { type: String, enum: ['hls', 'youtube', 'dailymotion'], default: 'hls' },
  streamUrl: { type: String, default: '' },
  ytVideoId: { type: String },
  referer: { type: String },
  userAgent: { type: String },
  enabled: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 100, index: true },
  isOnline: { type: Boolean, default: true },
  source: { type: String, default: 'seed' },
}, { timestamps: true });

const LiveChannel = mongoose.models.LiveChannel || mongoose.model('LiveChannel', LiveChannelSchema);

async function runSeed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI introuvable dans scrapper/.env');
    process.exit(1);
  }

  console.log('📡 Connexion à MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connecté à MongoDB.');

  console.log(`\n🌱 Début du seed pour ${LIVE_SEED.length} chaînes avec priorité SPORT...`);

  let created = 0;
  let updated = 0;

  for (const item of LIVE_SEED) {
    const existing = await LiveChannel.findOne({ slug: item.slug });
    if (existing) {
      existing.name = item.name;
      existing.categories = item.categories;
      existing.country = item.country;
      existing.language = item.language;
      existing.type = item.type;
      existing.streamUrl = item.streamUrl;
      existing.logo = item.logo;
      existing.enabled = true;
      existing.order = item.order;
      existing.isOnline = true;
      if (item.referer) existing.referer = item.referer;
      await existing.save();
      console.log(`  🔄 [Mis à jour] ${item.order}. ${item.name} (${item.categories.join(', ')})`);
      updated++;
    } else {
      await LiveChannel.create(item);
      console.log(`  ✨ [Créé] ${item.order}. ${item.name} (${item.categories.join(', ')})`);
      created++;
    }
  }

  console.log('\n========================================');
  console.log(`🎉 Seed terminé avec succès !`);
  console.log(`   ✨ Nouvelles chaînes : ${created}`);
  console.log(`   🔄 Chaînes mises à jour : ${updated}`);
  console.log(`   🏆 Chaînes Sport en tête : beIN SPORTS, Red Bull TV, Fight Sports`);
  console.log('========================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Erreur lors du seed:', err);
  process.exit(1);
});
