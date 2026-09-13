import https from "https";
import { IncomingMessage } from "http";
import { URL } from "url";

const UPSTREAM_ORIGIN = "https://popcornofficial.com";
const QUERY_URL = `${UPSTREAM_ORIGIN}/api/query`;

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 8,
  timeout: 20000,
});

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: UPSTREAM_ORIGIN,
  referer: `${UPSTREAM_ORIGIN}/`,
  "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
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

function storeSetCookie(raw: string | string[] | undefined) {
  const list = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) cookieJar.set(name, value);
  }
}

type UpstreamResponse = { status: number; headers: IncomingMessage["headers"]; body: string };

function request(url: string, method: string, extraHeaders: Record<string, string> = {}, body?: string) {
  return new Promise<UpstreamResponse>((resolve, reject) => {
    const parsed = new URL(url);
    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      ...extraHeaders,
      host: parsed.host,
    };
    const cookies = cookieHeader();
    if (cookies) headers.cookie = cookies;
    if (body) headers["content-length"] = String(Buffer.byteLength(body));

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        agent,
      },
      (res) => {
        storeSetCookie(res.headers["set-cookie"]);
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(25000, () => req.destroy(new Error("upstream timeout")));
    if (body) req.write(body);
    req.end();
  });
}

function isRetryableStatus(status: number) {
  return status === 403 || status === 429 || status === 503 || status === 1020 || status === 0;
}

function looksLikeChallenge(body: string) {
  const lower = body.slice(0, 800).toLowerCase();
  return (
    lower.includes("<html") ||
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("attention required") ||
    lower.includes("cloudflare")
  );
}

function parseJsonBody(body: string) {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function warmupUpstream() {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      try {
        await request(UPSTREAM_ORIGIN + "/", "GET", {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none",
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

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) await sleep(400 * attempt);

    const response = await request(
      QUERY_URL,
      "POST",
      { "content-type": "application/json" },
      JSON.stringify({ cdKey })
    );

    lastStatus = response.status;
    lastBody = response.body;
    const json = parseJsonBody(lastBody);

    if (json && !looksLikeChallenge(lastBody)) {
      return json;
    }

    console.error(
      `[upstream] attempt=${attempt + 1} status=${response.status} cookies=${cookieJar.size} body=${lastBody.slice(0, 180).replace(/\s+/g, " ")}`
    );

    if (!isRetryableStatus(response.status) && !looksLikeChallenge(lastBody)) {
      break;
    }

    try {
      await request(UPSTREAM_ORIGIN + "/", "GET", {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
      });
    } catch {
      // keep retrying the query even if warmup fails
    }
  }

  return {
    ok: false,
    message: `Upstream error (${lastStatus || "network"})`,
  };
}
