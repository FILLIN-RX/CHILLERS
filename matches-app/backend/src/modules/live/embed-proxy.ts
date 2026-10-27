import type { Request, Response } from 'express';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function getOptimalReferer(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h.includes('kora') || h.includes('goalakor') || h.includes('hesgoal') || h.includes('dynproclaim')) {
    return 'https://goalakor.space/';
  }
  if (h.includes('yasirtv') || h.includes('kooorah') || h.includes('albaplayer') || h.includes('livekora') || h.includes('koora-tv')) {
    return 'https://www.livekora.vip/';
  }
  if (h.includes('yalla') || h.includes('yallapro')) {
    return 'https://to.yallapro.cfd/';
  }
  if (h.includes('streamiz') || h.includes('livetv')) {
    return 'https://streamiz.lol/';
  }
  return `https://${hostname}/`;
}

export async function embedProxy(req: Request, res: Response): Promise<void> {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  if (!rawUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    res.status(400).send('Invalid URL');
    return;
  }

  const refererParam =
    (typeof req.query.referer === 'string' && req.query.referer) || getOptimalReferer(targetUrl.hostname);

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,ar;q=0.6',
        Referer: refererParam,
        Origin: new URL(refererParam).origin,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
      return;
    }

    let html = await upstream.text();
    const baseHref = `${targetUrl.protocol}//${targetUrl.host}${targetUrl.pathname.substring(
      0,
      targetUrl.pathname.lastIndexOf('/') + 1,
    )}`;

    html = html.replace(/<meta[^>]*http-equiv=["']?(x-frame-options|content-security-policy)["']?[^>]*>/gi, '');
    html = html.replace(/<script\b[^>]*cloudflareinsights[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script\b[^>]*>[\s\S]*?(?:cloudflareinsights|cdn-cgi\/rum)[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\s*data-cf-beacon=(["'])[\s\S]*?\1/gi, '');

    const adBlockerScript = `
<script>
  (function() {
    try {
      Object.defineProperty(document, 'referrer', { get: function() { return ${JSON.stringify(refererParam)}; }, configurable: true });
    } catch(e) {}
    window.open = function() { return null; };
    window.alert = function() {};
    window.confirm = function() { return true; };
    window.prompt = function() { return null; };
    try {
      window.onbeforeunload = null;
      Object.defineProperty(window, 'top', { get: function() { return window; }, configurable: true });
      Object.defineProperty(window, 'parent', { get: function() { return window; }, configurable: true });
    } catch(e) {}
    document.addEventListener('click', function(e) {
      var a = e.target.closest('a');
      if (a && a.target === '_blank' && !a.href.includes('.m3u8') && !a.href.includes('.mp4')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  })();
</script>`;

    const baseTag = `<base href="${baseHref}">${adBlockerScript}`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${baseTag}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head[^>]*>/, `$&${baseTag}`);
    } else {
      html = `${baseTag}${html}`;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Security-Policy',
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; style-src * 'unsafe-inline' data:; font-src * data:; media-src * data: blob:; connect-src * data: blob:; img-src * data: blob:; frame-src *;",
    );
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(502).send(`Embed proxy error: ${message}`);
  }
}
