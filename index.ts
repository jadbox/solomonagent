#!/usr/bin/env bun
import { chromium } from "playwright";
import { homedir } from "os";
import { existsSync } from "fs";

// Common Chrome profile paths
const PROFILE_PATHS = {
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

async function getPageTitle(url: string): Promise<string> {
  const profilePath = detectChromeProfile();
  if (!profilePath) throw new Error("Chrome profile not found");

  const browser = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = await page.title();
    return title;
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);

    // Check if URL parameter is provided
    if (args.length === 0) {
      console.log("Usage: bun run index.ts <url>");
      console.log("Example: bun run index.ts https://example.com");
      process.exit(1);
    }

    const url = args[0]!;

    // Validate URL format
    try {
      new URL(url);
    } catch {
      console.error("Invalid URL format. Please provide a valid URL.");
      process.exit(1);
    }

    console.log(`Fetching title for: ${url}`);
    const title = await getPageTitle(url);
    console.log(`Page title: ${title}`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

function detectChromeProfile(): string | null {
  // Check native platform paths
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

main();
