// src/browserUtils.ts
import { chromium, type BrowserContext, type Page } from "playwright";
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
export let page: Page | undefined = undefined;

export async function getPageContentAndTitle(url: string) {
  console.log("[getPageContentAndTitle] Starting function...");
  // const profilePath = detectChromeProfile(); // Profile path not strictly needed for headless
  // if (!profilePath) {
  //   console.error("[getPageContentAndTitle] Chrome profile not found");
  //   throw new Error("Chrome profile not found");
  // }

  try {
    if (!browser) {
      console.log(
        "[getPageContentAndTitle] Browser not initialized. Launching new browser instance..."
      );
      const regularBrowserInstance = await chromium.launch({
        headless: true, // Ensure headless is true for server environments
        args: [
          "--disable-blink-features=AutomationControlled",
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
        timeout: 10000, // Increased timeout for launch
      });
      console.log(
        "[getPageContentAndTitle] New browser instance launched successfully."
      );
      browser = await regularBrowserInstance.newContext({
        locale: "en-US",
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone, // get user's current Tz like "America/New_York"
        javaScriptEnabled: true,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });
      console.log("[getPageContentAndTitle] New browser context created.");
    }

    if (!page || page.isClosed()) {
      if (!browser) {
        // This should ideally not happen if the above block executed
        console.error(
          "[getPageContentAndTitle] Browser context not available to create new page."
        );
        throw new Error("Browser context not available to create new page.");
      }
      console.log(
        "[getPageContentAndTitle] Page not initialized or closed. Creating new page..."
      );
      page = await browser.newPage();
      console.log("[getPageContentAndTitle] New page created.");
    }

    console.log(`[getPageContentAndTitle] Navigating to: ${url}`);
    const navigationTimeout = 10000; // Increased navigation timeout

    // Use the module-level 'page'
    const r = await page.goto(url, {
      timeout: navigationTimeout,
      waitUntil: "domcontentloaded",
    });
    const title = await page.title();
    const content = await page.content();

    console.log(
      "[getPageContentAndTitle] Page navigation successful. Status:",
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
    // Removed browser.close() from here. It will be closed by closeBrowser()
    // if (browser) {
    //   console.log(
    //     "[getPageContentAndTitle] Attempting to close browser due to error..."
    //   );
    //   await browser.close();
    //   browser = undefined;
    //   page = undefined;
    // }
    throw error; // Rethrow error after logging
  } finally {
    // Browser is no longer closed here to keep it alive for subsequent actions.
    console.log("[getPageContentAndTitle] Page content processing finished.");
  }
}

export async function closeBrowser() {
  if (page && !page.isClosed()) {
    console.log("[closeBrowser] Closing page...");
    await page.close();
    page = undefined;
  }
  if (browser) {
    console.log("[closeBrowser] Closing browser context...");
    await browser.close();
    browser = undefined; // Reset browser variable
    console.log("[closeBrowser] Browser context closed successfully.");
  } else {
    console.log("[closeBrowser] Browser already closed or not initialized.");
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
