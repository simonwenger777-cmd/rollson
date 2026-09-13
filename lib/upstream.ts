import { Impit } from "impit";
import { queryViaBrowser } from "./browser-query";

const UPSTREAM_ORIGIN = "https://popcornofficial.com";
const QUERY_URL = `${UPSTREAM_ORIGIN}/api/query`;

const client = new Impit({
  browser: "chrome",
});

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

export async function warmupUpstream() {
  try {
    const { prepareBrowser } = await import("./browser-query");
    await prepareBrowser();
  } catch (error) {
    console.error("[upstream] browser warmup failed", error);
  }
}

async function queryViaImpit(cdKey: string) {
  const response = await client.fetch(QUERY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: UPSTREAM_ORIGIN,
      referer: `${UPSTREAM_ORIGIN}/`,
    },
    body: JSON.stringify({ cdKey }),
    redirect: "follow",
  });
  const lastBody = await response.text();
  const json = parseJsonBody(lastBody);
  if (json && !looksLikeChallenge(lastBody)) return json;
  throw new Error(`impit-challenge:${response.status}`);
}

export async function queryUpstream(cdKey: string) {
  try {
    return await queryViaBrowser(cdKey);
  } catch (browserError) {
    console.error("[upstream] browser query failed", browserError);
    try {
      return await queryViaImpit(cdKey);
    } catch (impitError) {
      console.error("[upstream] impit query failed", impitError);
      return { ok: false, message: "Upstream error (403)" };
    }
  }
}
