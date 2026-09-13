import https from "https";
import { IncomingMessage } from "http";
import { URL } from "url";

const UPSTREAM_ORIGIN = "https://popcornofficial.com";
const QUERY_URL = `${UPSTREAM_ORIGIN}/api/query`;

const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

const cookieJar = new Map<string, string>();

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: UPSTREAM_ORIGIN,
  referer: `${UPSTREAM_ORIGIN}/`,
};

type UpstreamResponse = { status: number; body: string };

function storeCookies(raw: string | string[] | undefined) {
  const list = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    const pair = item.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function request(url: string, method: string, extra: Record<string, string> = {}, body?: string) {
  return new Promise<UpstreamResponse>((resolve, reject) => {
    const parsed = new URL(url);
    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      ...extra,
      host: parsed.host,
    };
    if (cookieJar.size) {
      headers.cookie = Array.from(cookieJar.entries())
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
        storeCookies(res.headers["set-cookie"]);
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.setTimeout(12000, () => req.destroy(new Error("upstream timeout")));
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
  const lower = body.slice(0, 400).toLowerCase();
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

export async function warmupUpstream() {
  try {
    await request(`${UPSTREAM_ORIGIN}/`, "GET", {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    });
  } catch (error) {
    console.error("[upstream] warmup failed", error);
  }
}

export async function queryUpstream(cdKey: string) {
  await warmupUpstream();

  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(300 * attempt);

    const response = await request(
      QUERY_URL,
      "POST",
      { "content-type": "application/json" },
      JSON.stringify({ cdKey })
    );
    lastStatus = response.status;
    lastBody = response.body;

    const json = parseJson(lastBody);
    if (json && !isChallenge(response.status, lastBody)) {
      return json;
    }

    if (!isChallenge(response.status, lastBody)) break;

    try {
      await request(`${UPSTREAM_ORIGIN}/`, "GET", {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      });
    } catch {
      // retry the POST anyway
    }
  }

  return {
    ok: false,
    message: `Upstream error (${lastStatus || "network"})`,
  };
}
