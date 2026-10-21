// Happy Wheels relay for Cloudflare Workers.
// Forwards the game's POST /get_level.hw requests to totaljerkface.com and
// adds CORS headers so the game page (hosted anywhere) can read the response.
// It only ever talks to the one fixed upstream URL below, so it is not an open proxy.

const UPSTREAM = "https://totaljerkface.com/get_level.hw";

// Optional: lock the relay to your own game page(s), e.g. ["https://yourname.github.io"].
// Leave empty to allow any origin.
const ALLOWED_ORIGINS = [];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response("forbidden", { status: 403 });
    }

    const cors = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("Access-Control-Request-Headers") || "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    if (origin) cors["Access-Control-Allow-Credentials"] = "true";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/get_level.hw" && url.pathname !== "/") {
      return new Response("not found", { status: 404, headers: cors });
    }
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response("method not allowed", { status: 405, headers: cors });
    }

    // Look like the real site to the upstream server.
    const headers = new Headers();
    const ct = request.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    headers.set("Origin", "https://totaljerkface.com");
    headers.set("Referer", "https://totaljerkface.com/happy_wheels.tjf");
    headers.set(
      "User-Agent",
      request.headers.get("User-Agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36"
    );

    let upstream;
    try {
      upstream = await fetch(UPSTREAM + url.search, {
        method: request.method,
        headers,
        body: request.method === "POST" ? await request.arrayBuffer() : undefined,
      });
    } catch (err) {
      return new Response("upstream error: " + err.message, { status: 502, headers: cors });
    }

    // Pass the body through untouched (level data is binary).
    const out = new Headers(cors);
    const upCt = upstream.headers.get("Content-Type");
    if (upCt) out.set("Content-Type", upCt);
    out.set("Cache-Control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
