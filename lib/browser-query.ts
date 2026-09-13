import chromium from "@sparticuz/chromium";
import puppeteer, { Browser, Page } from "puppeteer-core";

const UPSTREAM_ORIGIN = "https://popcornofficial.com";
const QUERY_BUDGET_MS = 45000;

let browserPromise: Promise<Browser> | null = null;
let page: Page | null = null;
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isUsefulJson(json: Record<string, unknown> | null | undefined) {
  if (!json) return false;
  const message = typeof json.message === "string" ? json.message : "";
  return !message.includes("Upstream error") && !message.includes("timed out");
}

async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: [
      ...chromium.args,
      "--disable-dev-shm-usage",
      "--no-zygote",
      "--disable-blink-features=AutomationControlled",
    ],
    defaultViewport: { width: 1365, height: 768 },
    executablePath,
    headless: true,
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

async function openSite(target: Page) {
  try {
    await target.goto(`${UPSTREAM_ORIGIN}/`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
  } catch {
    // Cloudflare may abort the first navigation.
  }
  await sleep(2000);
}

async function getPage() {
  const browser = await getBrowser();
  if (!page || page.isClosed()) {
    page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    );
    await openSite(page);
  }
  return page;
}

async function postKey(target: Page, cdKey: string) {
  return target.evaluate(async (key) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cdKey: key }),
        signal: controller.signal,
      });
      const text = await response.text();
      try {
        return { json: JSON.parse(text) as Record<string, unknown> };
      } catch {
        return { json: null, preview: text.slice(0, 120) };
      }
    } catch (error) {
      return { json: null, preview: String(error) };
    } finally {
      window.clearTimeout(timer);
    }
  }, cdKey);
}

export async function prepareBrowser() {
  await getPage();
}

export async function queryViaBrowser(cdKey: string) {
  return withTimeout(
    enqueue(async () => {
      let target = await getPage();

      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (attempt === 2) {
          await openSite(target);
        }
        if (attempt > 0) await sleep(600);

        const result = await postKey(target, cdKey);
        if (isUsefulJson(result.json)) return result.json!;
        console.error(
          `[browser-query] attempt=${attempt + 1} preview=${result.preview || JSON.stringify(result.json)}`
        );
      }

      throw new Error("browser query still blocked");
    }),
    QUERY_BUDGET_MS,
    "inbox lookup"
  );
}
