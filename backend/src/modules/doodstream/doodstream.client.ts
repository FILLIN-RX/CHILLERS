import axios from 'axios';

const BASE_URL = 'https://doodapi.co/api';
const API_KEY = process.env.DOODSTREAM_API_KEY || '';

const doodClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  params: { key: API_KEY },
});

doodClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.msg || err.message;
    console.error(`[DoodStream] ${msg}`);
    throw err;
  }
);

export default doodClient;
