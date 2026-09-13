import { Impit } from "impit";

const UPSTREAM_ORIGIN = "https://popcornofficial.com";
const QUERY_URL = `${UPSTREAM_ORIGIN}/api/query`;

const client = new Impit({
  browser: "chrome",
});

let warmupPromise: Promise<void> | null = null;

function looksLikeChallenge(body: string) {
  const lower = body.slice(0, 800).toLowerCase();
  return (
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("attention required") ||
    (lower.includes("<html") && lower.includes("cloudflare"))
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

function isRetryableStatus(status: number) {
  return status === 403 || status === 429 || status === 503 || status === 1020 || status === 0;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function impersonatedFetch(
  url: string,
  init: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string } = {}
) {
  return client.fetch(url, {
    method: init.method ?? "GET",
    headers: init.headers,
    body: init.body,
    redirect: "follow",
  });
}

export async function warmupUpstream() {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      try {
        await impersonatedFetch(`${UPSTREAM_ORIGIN}/`, {
          method: "GET",
          headers: {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
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

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(350 * attempt);

    const response = await impersonatedFetch(QUERY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: UPSTREAM_ORIGIN,
        referer: `${UPSTREAM_ORIGIN}/`,
      },
      body: JSON.stringify({ cdKey }),
    });

    lastStatus = response.status;
    lastBody = await response.text();
    const json = parseJsonBody(lastBody);

    if (json && !looksLikeChallenge(lastBody)) {
      return json;
    }

    console.error(
      `[upstream] attempt=${attempt + 1} status=${response.status} body=${lastBody.slice(0, 160).replace(/\s+/g, " ")}`
    );

    if (!isRetryableStatus(response.status) && !looksLikeChallenge(lastBody)) {
      break;
    }

    try {
      await impersonatedFetch(`${UPSTREAM_ORIGIN}/`, { method: "GET" });
    } catch {
      // retry query anyway
    }
  }

  return {
    ok: false,
    message: `Upstream error (${lastStatus || "network"})`,
  };
}
