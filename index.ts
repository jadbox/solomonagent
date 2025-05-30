#!/usr/bin/env bun
import { chromium } from "playwright";
import { homedir } from "os";
import { existsSync } from "fs";
import * as cheerio from "cheerio";
// import Parser from "@postlight/parser";
// import  @mozilla/readability
import Readability from "@mozilla/readability";
import { createSelection, createPrompt } from "bun-promptx";

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

async function getPageContentAndTitle(
  url: string
): Promise<{ title: string; content: string }> {
  const profilePath = detectChromeProfile();
  if (!profilePath) throw new Error("Chrome profile not found");

  const browser = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    javaScriptEnabled: true, // Enable JavaScript for the context
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36", // Set user agent for the context
    viewport: { width: 1280, height: 720 }, // Set viewport for the context
  });

  try {
    const page = await browser.newPage(); // newPage() takes no arguments with launchPersistentContext
    await page.route("**.jpg", (route) => route.abort());
    await page.route("**.jpeg", (route) => route.abort());
    await page.route("**.png", (route) => route.abort());
    await page.route("**.gif", (route) => route.abort());
    await page.route("**.webp", (route) => route.abort());
    // Wait until the network is idle, which is often better for JS-heavy pages
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }); // Increased timeout for networkidle
    const title = await page.title();
    const content = await page.content(); // Get the full page content
    // Use Postlight Parser to extract structured content
    const dom = cheerio.load(content);
    if (!dom) throw new Error("Failed to load page content");

    // create a Document object for Readability

    // console.log("dom._root", dom._root);
    // const passed = new Readability.Readability(dom._root).parse();
    // if (!passed) throw new Error("Failed to parse page content");
    // if (!passed.content) throw new Error("No content found in the page");

    // console.log(
    //   `Page content fetched successfully for: ${url}`,
    //   passed.content
    // );

    console.log(`Page title: ${title}`);

    return {
      title,
      content: dom.html() || "",
    };
  } finally {
    await browser.close();
  }
}

import OpenAI from "openai";

// Configure OpenAI SDK for Gemini (assuming a compatible proxy endpoint)
// IMPORTANT: You may need to change the baseURL to your specific Gemini proxy endpoint.
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", // Replace with your actual Gemini-compatible endpoint
});

async function summarizePage(content: string) {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that summarizes web page content concisely to 2 sentances, focusing on key page data and user actions. Return as plain text the critical page information to the user and a CSV list of 1 - 10 top key actions (ranked from most common to least) in double brackets, like [[search:form, next_page:link, about:link]]. Focus on key details (account status, balance, top 10 feed, or search form action, etc).",
      },
      {
        role: "user",
        content: `Please summarize the following web page content:\n\n${content}`,
      },
    ],
    model: "gemini-2.5-flash-preview-05-20", // Using the requested Gemini model
  });

  const actions = completion.choices[0]?.message?.content
    ?.split("[[")[1]
    ?.split("]]")[0]
    ?.split(",");

  const _content = completion.choices[0]?.message?.content
    ?.split("[[")[0]
    ?.trim();

  return {
    content: _content || "No summary available.",
    actions: actions || [],
    html: content,
  };
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Please set the GEMINI_API_KEY environment variable.");
    process.exit(1);
  }
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

    console.log(`Fetching content for: ${url}`);
    const { title, content } = await getPageContentAndTitle(url);
    console.log(`Page title: ${title}`);

    console.log("Summarizing page content...");
    const summary = await summarizePage(content);
    console.log("\n--- Page Summary ---");
    console.log(summary);
    console.log("--------------------");
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
