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
  try {
    await target.goto(`${UPSTREAM_ORIGIN}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
  } catch (error) {
    const message = String(error);
    if (!message.includes("ERR_ABORTED") && !message.includes("Timeout") && !message.includes("net::")) {
      throw error;
    }
  }
  await target
    .waitForFunction(() => !document.title.toLowerCase().includes("just a moment"), {
      timeout: 25000,
    })
    .catch(() => undefined);
  await target
    .waitForSelector("input.email-input, form.mailbox-form, .mailbox-form", {
      timeout: 20000,
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

async function postKey(target: Page, cdKey: string) {
  return target.evaluate(async (key) => {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cdKey: key }),
    });
    const text = await response.text();
    try {
      return { okHttp: response.ok, json: JSON.parse(text) as Record<string, unknown> };
    } catch {
      return { okHttp: false, json: null, preview: text.slice(0, 120) };
    }
  }, cdKey);
}

export async function prepareBrowser() {
  await getPage();
}

export async function queryViaBrowser(cdKey: string) {
  return enqueue(async () => {
    let target = await getPage();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const title = await target.title();
      if (title.toLowerCase().includes("just a moment")) {
        await waitForSite(target);
      }

      const result = await postKey(target, cdKey);
      if (result.json && !(typeof result.json.message === "string" && result.json.message.includes("Upstream error"))) {
        return result.json;
      }

      console.error(
        `[browser-query] attempt=${attempt + 1} title=${title} preview=${"preview" in result ? result.preview : JSON.stringify(result.json)}`
      );
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    throw new Error("browser query still blocked");
  });
}
