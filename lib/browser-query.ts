import chromium from "@sparticuz/chromium";
import puppeteer, { Browser, Page } from "puppeteer-core";

const UPSTREAM_ORIGIN = "https://popcornofficial.com";
const QUERY_BUDGET_MS = 22000;

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

async function preparePage(target: Page) {
  await target.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  await target.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
  );
  try {
    await target.goto(`${UPSTREAM_ORIGIN}/`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
  } catch {
    // Cloudflare may abort the first navigation.
  }
  await target
    .waitForFunction(() => !document.title.toLowerCase().includes("just a moment"), {
      timeout: 12000,
    })
    .catch(() => undefined);
  await target.waitForSelector("input.email-input", { timeout: 12000 });
}

async function getReadyPage() {
  const browser = await getBrowser();
  if (!page || page.isClosed()) {
    page = await browser.newPage();
    await preparePage(page);
  } else {
    const title = await page.title().catch(() => "");
    const hasInput = await page.$("input.email-input");
    if (title.toLowerCase().includes("just a moment") || !hasInput) {
      await preparePage(page);
    }
  }
  return page;
}

async function submitKey(target: Page, cdKey: string) {
  const responsePromise = target.waitForResponse(
    (response) => response.url().includes("/api/query") && response.request().method() === "POST",
    { timeout: 12000 }
  );

  await target.waitForSelector("input.email-input", { timeout: 8000 });
  await target.$eval(
    "input.email-input",
    (element, value) => {
      const input = element as HTMLInputElement;
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      proto?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    cdKey
  );

  const button = await target.$("button.primary-btn");
  if (button) await button.click();
  else await target.keyboard.press("Enter");

  const response = await responsePromise;
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`non-json upstream: ${text.slice(0, 80)}`);
  }
}

export async function prepareBrowser() {
  await getReadyPage();
}

export async function queryViaBrowser(cdKey: string) {
  return withTimeout(
    enqueue(async () => {
      let target = await getReadyPage();
      try {
        return await submitKey(target, cdKey);
      } catch (firstError) {
        console.error("[browser-query] first submit failed", firstError);
        try {
          if (page && !page.isClosed()) await page.close();
        } catch {
          // ignore
        }
        page = null;
        await sleep(400);
        target = await getReadyPage();
        return submitKey(target, cdKey);
      }
    }),
    QUERY_BUDGET_MS,
    "inbox lookup"
  );
}
