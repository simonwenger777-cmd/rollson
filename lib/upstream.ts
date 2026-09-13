import { queryViaBrowser } from "./browser-query";

export async function warmupUpstream() {
  try {
    const { prepareBrowser } = await import("./browser-query");
    await prepareBrowser();
  } catch (error) {
    console.error("[upstream] browser warmup failed", error);
  }
}

export async function queryUpstream(cdKey: string) {
  try {
    return await queryViaBrowser(cdKey);
  } catch (browserError) {
    console.error("[upstream] browser query failed", browserError);
    return { ok: false, message: "Upstream error (403)" };
  }
}
