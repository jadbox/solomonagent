// src/browserUtils.ts
import { chromium, type BrowserContext } from "playwright";
import { homedir } from "os";
import { existsSync } from "fs";
import * as cheerio from "cheerio";

// Common Chrome profile paths
export const PROFILE_PATHS = {
  linux: `${homedir()}/.config/google-chrome`,
  linuxBeta: `${homedir()}/.config/google-chrome-beta`,
  windows: `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`,
  windowsBeta: `${process.env.LOCALAPPDATA}\\Google\\Chrome Beta\\User Data`,
  wsl: `/mnt/c/Users/${process.env.USER}/AppData/Local/Google/Chrome/User Data`,
  wslBeta: `/mnt/c/Users/${process.env.USER}/AppData/Local/Google/Chrome Beta/User Data`,
  wsl_short: `/mnt/c/Users/${process.env.USER?.substring(
    0,
    5
  )}/AppData/Local/Google/Chrome/User Data`,
  wslBeta_short: `/mnt/c/Users/${process.env.USER?.substring(
    0,
    5
  )}/AppData/Local/Google/Chrome Beta/User Data`,
};

export let browser: BrowserContext | undefined = undefined;

export async function getPageContentAndTitle(url: string) {
  console.log("[getPageContentAndTitle] Starting function...");
  const profilePath = detectChromeProfile();
  if (!profilePath) {
    console.error("[getPageContentAndTitle] Chrome profile not found");
    throw new Error("Chrome profile not found");
  }

  try {
    console.log(
      "[getPageContentAndTitle] Launching new browser instance (non-persistent).."
    );

    const regularBrowser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-features=VizDisplayCompositor",
        "--disable-extensions",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
      timeout: 5000, // 5 seconds
    });

    console.log(
      "[getPageContentAndTitle] New browser instance launched successfully."
    );

    browser = await regularBrowser.newContext({
      javaScriptEnabled: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    console.log(
      "[getPageContentAndTitle] New browser instance and context launched."
    );

    if (!browser) {
      console.error(
        "[getPageContentAndTitle] Browser context not initialized before creating page."
      );
      throw new Error("Browser context not initialized");
    }
    console.log("[getPageContentAndTitle] Creating new page...");
    const page = await browser.newPage();
    console.log("[getPageContentAndTitle] New page created.");

    console.log(`Navigating to: ${url}`);
    const navigationTimeout = 6000;

    const r = await page.goto(url, {
      timeout: navigationTimeout,
      waitUntil: "domcontentloaded",
    });
    const title = await page.title();
    const content = await page.content();

    console.log(
      "[getPageContentAndTitle] Page loaded successfully. Status:",
      r?.status(),
      "OK:",
      r?.ok()
    );

    const dom = cheerio.load(content);
    if (!dom) {
      console.error(
        "[getPageContentAndTitle] Failed to load page content with Cheerio"
      );
      throw new Error("Failed to load page content with Cheerio");
    }

    const htmlContent = dom.html();
    if (!htmlContent) {
      console.warn(
        "[getPageContentAndTitle] Cheerio dom.html() returned empty or null."
      );
    }

    // console.log(`[getPageContentAndTitle] Page title: ${title}`);

    return {
      title,
      content: htmlContent || "",
    };
  } catch (error) {
    console.error(
      "[getPageContentAndTitle] Error fetching page content:",
      error
    );
    if (browser) {
      console.log(
        "[getPageContentAndTitle] Attempting to close browser due to error..."
      );
      await browser.close();
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log("Page loaded successfully.");
    } else {
      console.log(
        "[getPageContentAndTitle] Browser context was not initialized or already closed, skipping close in finally block."
      );
    }
  }
}

export function detectChromeProfile(): string | null {
  switch (process.platform) {
    case "linux":
      if (existsSync(PROFILE_PATHS.wsl)) return PROFILE_PATHS.wsl;
      if (existsSync(PROFILE_PATHS.wslBeta)) return PROFILE_PATHS.wslBeta;
      if (existsSync(PROFILE_PATHS.wsl_short)) return PROFILE_PATHS.wsl_short;
      if (existsSync(PROFILE_PATHS.wslBeta_short))
        return PROFILE_PATHS.wslBeta_short;

      if (existsSync(PROFILE_PATHS.linux)) return PROFILE_PATHS.linux;
      if (existsSync(PROFILE_PATHS.linuxBeta)) return PROFILE_PATHS.linuxBeta;
      return null;
    case "win32":
      if (existsSync(PROFILE_PATHS.windows)) return PROFILE_PATHS.windows;
      if (existsSync(PROFILE_PATHS.windowsBeta))
        return PROFILE_PATHS.windowsBeta;
      return null;
    default:
      return null;
  }
}
