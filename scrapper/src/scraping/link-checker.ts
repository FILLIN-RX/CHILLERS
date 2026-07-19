import axios from 'axios';

export async function isLinkDead(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return response.status !== 200;
  } catch {
    console.log(`[LinkCheck] Dead link detected: ${url}`);
    return true;
  }
}
