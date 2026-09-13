export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmupUpstream } = await import("./lib/upstream");
    void warmupUpstream();
  }
}
