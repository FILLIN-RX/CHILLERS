import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const TMDB_TOKEN = process.env.TMDB_TOKEN;
const TMDB_LANGUAGE = process.env.TMDB_LANGUAGE || 'fr-FR';

const tmdbClient = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  headers: {
    Authorization: `Bearer ${TMDB_TOKEN}`,
    'Content-Type': 'application/json',
  },
  params: { language: TMDB_LANGUAGE },
});

export default tmdbClient;
