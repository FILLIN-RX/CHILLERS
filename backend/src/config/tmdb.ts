import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const tmdbClient = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export default tmdbClient;
