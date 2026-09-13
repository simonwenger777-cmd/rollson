const UPSTREAM_ORIGIN = "https://popcornofficial.com";
const QUERY_URL = `${UPSTREAM_ORIGIN}/api/query`;

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: UPSTREAM_ORIGIN,
  referer: `${UPSTREAM_ORIGIN}/`,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

const cookieJar = new Map<string, string>();
let warmupPromise: Promise<void> | null = null;

function cookieHeader() {
  if (!cookieJar.size) return "";
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function storeCookies(headers: Headers) {
  const listed =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const fallback = headers.get("set-cookie");
  const raw = listed.length ? listed : fallback ? [fallback] : [];
  for (const item of raw) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) cookieJar.set(name, value);
  }
}

async function upstreamFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(BROWSER_HEADERS);
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  const cookies = cookieHeader();
  if (cookies) headers.set("cookie", cookies);

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    redirect: "follow",
  });
  storeCookies(response.headers);
  return response;
}

function isRetryableStatus(status: number) {
  return status === 403 || status === 429 || status === 503 || status === 1020;
}

function looksLikeChallenge(body: string) {
  const lower = body.slice(0, 400).toLowerCase();
  return (
    lower.includes("<html") ||
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("attention required")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function warmupUpstream() {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      try {
        await upstreamFetch(UPSTREAM_ORIGIN, {
          method: "GET",
          headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        });
      } catch {
        warmupPromise = null;
      }
    })();
  }
  return warmupPromise;
}

export async function queryUpstream(cdKey: string) {
  await warmupUpstream();

  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(250 * attempt);

    const response = await upstreamFetch(QUERY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cdKey }),
    });

    lastStatus = response.status;
    lastBody = await response.text();

    const contentType = response.headers.get("content-type") || "";
    const jsonLike = contentType.includes("application/json") || lastBody.trim().startsWith("{");

    if (jsonLike && !looksLikeChallenge(lastBody)) {
      try {
        return JSON.parse(lastBody) as Record<string, unknown>;
      } catch {
        break;
      }
    }

    if (!isRetryableStatus(response.status) && !looksLikeChallenge(lastBody)) {
      break;
    }

    // First 403 from Cloudflare often sets cookies; retry with the jar.
    if (attempt === 0) {
      try {
        await upstreamFetch(UPSTREAM_ORIGIN, {
          method: "GET",
          headers: { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
        });
      } catch {
        // ignore warmup failures and still retry the query
      }
    }
  }

  return {
    ok: false,
    message: `Upstream error (${lastStatus || "network"})`,
  };
}
