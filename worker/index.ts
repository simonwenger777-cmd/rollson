const UPSTREAM = "https://popcornofficial.com";

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: UPSTREAM,
  referer: `${UPSTREAM}/`,
};

export interface Env {
  ASSETS: { fetch: typeof fetch };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function collectCookies(headers: Headers, jar: Map<string, string>) {
  const listed = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const fallback = headers.get("set-cookie");
  const raw = listed.length ? listed : fallback ? [fallback] : [];
  for (const item of raw) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function parseJson(body: string) {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isChallenge(status: number, body: string, json: Record<string, unknown> | null) {
  const lower = body.slice(0, 400).toLowerCase();
  const message = typeof json?.message === "string" ? json.message : "";
  return (
    status === 403 ||
    status === 503 ||
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification") ||
    message.includes("Upstream error")
  );
}

async function upstreamFetch(path: string, jar: Map<string, string>, init: RequestInit = {}) {
  const headers = new Headers(BROWSER_HEADERS);
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  if (jar.size) {
    headers.set(
      "cookie",
      Array.from(jar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ")
    );
  }
  const response = await fetch(`${UPSTREAM}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body,
    redirect: "follow",
  });
  collectCookies(response.headers, jar);
  return response;
}

async function queryPopcorn(cdKey: string) {
  const jar = new Map<string, string>();
  try {
    await upstreamFetch("/", jar, {
      headers: { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
    });
  } catch {
    // continue even if the homepage warmup fails
  }

  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    const response = await upstreamFetch("/api/query", jar, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cdKey }),
    });
    lastStatus = response.status;
    const body = await response.text();
    const json = parseJson(body);
    if (json && json.ok === true) return json;
    if (json && !isChallenge(response.status, body, json)) return json;
  }
  return { ok: false, message: `Upstream error (${lastStatus || "network"})` };
}

async function handleQuery(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body" }, 400);
  }
  const cdKey =
    payload && typeof payload === "object" && "cdKey" in payload
      ? (payload as { cdKey?: unknown }).cdKey
      : undefined;
  if (typeof cdKey !== "string" || !cdKey.trim()) {
    return jsonResponse({ ok: false, message: "Invalid request body" }, 400);
  }
  try {
    return jsonResponse(await queryPopcorn(cdKey.trim()));
  } catch {
    return jsonResponse({ ok: false, message: "Network error. Please try again." });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/query" && request.method === "POST") {
      return handleQuery(request);
    }
    if (url.pathname === "/api/query" && request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
