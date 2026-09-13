import chromium from "@sparticuz/chromium";
import puppeteer, { Browser, Page } from "puppeteer-core";

const UPSTREAM_ORIGIN = "https://popcornofficial.com";

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

async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: [...chromium.args, "--disable-dev-shm-usage", "--no-zygote"],
    defaultViewport: { width: 1280, height: 720 },
    executablePath,
    headless: true,
  });
}

async function waitForSite(target: Page) {
  await target.goto(`${UPSTREAM_ORIGIN}/`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await target
    .waitForFunction(() => !document.title.toLowerCase().includes("just a moment"), {
      timeout: 25000,
    })
    .catch(() => undefined);
}

async function getPage() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  const browser = await browserPromise;
  if (!page || page.isClosed()) {
    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    );
    await waitForSite(page);
  }
  return page;
}

export async function prepareBrowser() {
  await getPage();
}

export async function queryViaBrowser(cdKey: string) {
  return enqueue(async () => {
    const target = await getPage();
    const title = await target.title();
    if (title.toLowerCase().includes("just a moment")) {
      await waitForSite(target);
    }

    const data = await target.evaluate(async (key) => {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cdKey: key }),
      });
      return response.json();
    }, cdKey);

    return data as Record<string, unknown>;
  });
}
