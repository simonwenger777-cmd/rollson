import https from "https";
import { IncomingMessage } from "http";
import { URL } from "url";

const UPSTREAMS = [
  process.env.UPSTREAM_ORIGIN || "https://popcornofficial.com",
  "https://rollson.onrender.com",
];

const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });
const cookieJars = new Map<string, Map<string, string>>();

function jarFor(origin: string) {
  let jar = cookieJars.get(origin);
  if (!jar) {
    jar = new Map();
    cookieJars.set(origin, jar);
  }
  return jar;
}

type UpstreamResponse = { status: number; body: string };

function storeCookies(origin: string, raw: string | string[] | undefined) {
  const jar = jarFor(origin);
  const list = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function request(origin: string, path: string, method: string, extra: Record<string, string> = {}, body?: string, timeoutMs = 15000) {
  return new Promise<UpstreamResponse>((resolve, reject) => {
    const parsed = new URL(path, origin);
    const jar = jarFor(origin);
    const headers: Record<string, string> = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      accept: extra.accept || "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      origin,
      referer: `${origin}/`,
      host: parsed.host,
      ...extra,
    };
    if (jar.size) {
      headers.cookie = Array.from(jar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    }
    if (body) headers["content-length"] = String(Buffer.byteLength(body));

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: 443,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        agent,
      },
      (res: IncomingMessage) => {
        storeCookies(origin, res.headers["set-cookie"]);
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("upstream timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
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

function isChallenge(status: number, body: string) {
  const lower = body.slice(0, 500).toLowerCase();
  return (
    status === 403 ||
    status === 503 ||
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryOrigin(origin: string, cdKey: string) {
  try {
    await request(origin, "/", "GET", {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    }, undefined, origin.includes("onrender.com") ? 25000 : 12000);
  } catch {
    // continue; cold Render instances often time out the first homepage hit
  }

  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(400 * attempt);
    const response = await request(
      origin,
      "/api/query",
      "POST",
      { "content-type": "application/json" },
      JSON.stringify({ cdKey }),
      origin.includes("onrender.com") ? 25000 : 12000
    );
    lastStatus = response.status;
    const json = parseJson(response.body);
    if (json && json.ok === true) return json;
    if (json && !isChallenge(response.status, response.body)) return json;
    if (!isChallenge(response.status, response.body) && json) return json;
  }
  return { ok: false, message: `Upstream error (${lastStatus || "network"})`, origin };
}

export async function warmupUpstream() {
  for (const origin of UPSTREAMS) {
    try {
      await request(origin, "/", "GET", {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      }, undefined, 8000);
    } catch {
      // ignore
    }
  }
}

export async function queryUpstream(cdKey: string) {
  let last: Record<string, unknown> | null = null;
  for (const origin of UPSTREAMS) {
    try {
      const result = await queryOrigin(origin, cdKey);
      if (result.ok === true) return result;
      last = result;
    } catch (error) {
      console.error("[upstream] origin failed", origin, error);
      last = { ok: false, message: "Upstream error (network)" };
    }
  }
  return last || { ok: false, message: "Upstream error (network)" };
}
