export async function warmupUpstream() {
  // Launch Chromium in the background so the first click is not blocked by startup.
  void import("./browser-query")
    .then(({ prepareBrowser }) => prepareBrowser())
    .catch((error) => console.error("[upstream] browser warmup failed", error));
}

export async function queryUpstream(cdKey: string) {
  const { queryViaBrowser } = await import("./browser-query");
  try {
    return await queryViaBrowser(cdKey);
  } catch (browserError) {
    console.error("[upstream] browser query failed", browserError);
    return { ok: false, message: "Inbox lookup timed out. Please try again." };
  }
}
