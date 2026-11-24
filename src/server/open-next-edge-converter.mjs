import { parse as parseCookie } from "cookie";

const nullBodyStatuses = new Set([101, 103, 204, 205, 304]);

const getQuery = (searchParams) => {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    const current = query[key];
    query[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
  }
  return query;
};

const parseSetCookieHeader = (cookies) => {
  if (!cookies) return [];
  if (Array.isArray(cookies)) return cookies;
  return cookies.split(/(?<!Expires=\w+),/i).map((cookie) => cookie.trim());
};

const converter = {
  name: "edge",
  convertFrom: async (event) => {
    const url = new URL(event.url);
    const headers = {};
    event.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const shouldHaveBody = event.method !== "GET" && event.method !== "HEAD";
    const cookieHeader = event.headers.get("cookie");

    return {
      type: "core",
      method: event.method,
      rawPath: url.pathname,
      url: event.url,
      body: shouldHaveBody ? Buffer.from(await event.arrayBuffer()) : undefined,
      headers,
      remoteAddress: event.headers.get("x-forwarded-for") ?? "::1",
      query: getQuery(url.searchParams),
      cookies: cookieHeader ? parseCookie(cookieHeader) : {},
    };
  },
  convertTo: async (result) => {
    if ("internalEvent" in result) {
      const request = new Request(result.internalEvent.url, {
        body: result.internalEvent.body,
        method: result.internalEvent.method,
        headers: {
          ...result.internalEvent.headers,
          "x-forwarded-host": result.internalEvent.headers.host,
        },
      });
      if (globalThis.__dangerous_ON_edge_converter_returns_request === true) return request;
      const rawPath = result.internalEvent.rawPath;
      const isMatchPage = /^\/live\/(sp|lb)\/[^/]+$/.test(rawPath);
      const cache = (result.isISR || isMatchPage || rawPath.startsWith("/_next/image")) && process.env.DISABLE_CACHE !== "true"
        ? { cacheEverything: true }
        : {};
      return fetch(request, { cf: cache });
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(result.headers)) {
      if (key === "set-cookie" && typeof value === "string") {
        for (const cookie of parseSetCookieHeader(value)) headers.append(key, cookie);
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else {
        headers.set(key, value);
      }
    }

    return new Response(nullBodyStatuses.has(result.statusCode) ? null : result.body, {
      status: result.statusCode,
      headers,
    });
  },
};

export default converter;
