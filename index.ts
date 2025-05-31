#!/usr/bin/env node --experimental-strip-types
import { chromium, type BrowserContext } from "playwright"; // Import Playwright for browser automation
import { homedir } from "os";
import { existsSync } from "fs";
import * as cheerio from "cheerio";
import {
  intro,
  outro,
  select,
  text,
  isCancel,
  cancel,
  spinner,
} from "@clack/prompts";
import color from "picocolors";

// import Parser from "@postlight/parser";
// import  @mozilla/readability
// import Readability from "@mozilla/readability"; // Readability is not used directly in the final plan for node finding

// Define the PageAction interface
interface PageAction {
  name: string;
  type: "form" | "link" | "other" | string;
  // description: string; // e.g., "search:form"
  url?: string; // Optional URL for the action, if applicable
  node?: any; // Changed to any as per user feedback
  element_id?: string; // Optional ID of the element if applicable
  element_attr_name?: string; // Optional attribute name of the element if applicable
}

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

let browser: BrowserContext | undefined = undefined; // Will become Browser for launch()

async function getPageContentAndTitle(url: string) {
  console.log("[getPageContentAndTitle] Starting function...");
  const profilePath = detectChromeProfile();
  if (!profilePath) {
    console.error("[getPageContentAndTitle] Chrome profile not found");
    throw new Error("Chrome profile not found");
  }
  // console.log(`[getPageContentAndTitle] Using profile path: ${profilePath}`); // Temporarily bypass profile for testing

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
    //
    // return { title: "", content: "" }; // Return empty title and content for now
    // IGNORE BELOW FOR NOW while debugging
    // Create a new context from the launched browser
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
    const page = await browser.newPage(); // newPage comes from the context
    console.log("[getPageContentAndTitle] New page created.");

    console.log(`[getPageContentAndTitle] Navigating to: ${url}`);
    const navigationTimeout = 12000;
    console.log(
      `[getPageContentAndTitle] Setting navigation timeout to ${navigationTimeout}ms`
    );
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

    console.log(`[getPageContentAndTitle] Page title: ${title}`);

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
      console.log(
        "[getPageContentAndTitle] Closing browser context in finally block..."
      );
      await browser.close(); // Closes the context
      // If we launched a regular browser, we need to close it too.
      // The 'regularBrowser' instance would need to be accessible here.
      // For simplicity in this step, we'll rely on the script ending to kill the browser process
      // or handle it more robustly if this approach works.
      // A better way:
      // const browserInstance = (browser as any).browser(); // Get parent browser if context
      // if (browserInstance) await browserInstance.close();

      console.log(
        "[getPageContentAndTitle] Browser context closed in finally block."
      );
    } else {
      console.log(
        "[getPageContentAndTitle] Browser context was not initialized or already closed, skipping close in finally block."
      );
    }
  }
}

import OpenAI from "openai";
import { url } from "inspector";
import { get } from "http";

// Configure OpenAI SDK for Gemini (assuming a compatible proxy endpoint)
// IMPORTANT: You may need to change the baseURL to your specific Gemini proxy endpoint.
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", // Replace with your actual Gemini-compatible endpoint
});

async function summarizePage(content: string, originalUrl: string) {
  const pathBase = new URL(originalUrl).pathname;
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that summarizes web page content concisely to 2 sentances, 
          focusing on key page data and user actions. 
          Return as plain text the critical page information to the user as a JSON in schema:
          {
            "content": "Page summary text",
            "actions": [
              {
                "name": "action label",
                "type": "form|link|button",
                "url": "<URL if applicable>",
                "element_id": "<ID of the element if applicable>",
                "element_attr_name": "<Attribute name of the element if applicable>"
              }
            ],
          }

          Actions are ordered 1 - 10 top key actions 
          (ranked from most common to least).
          
          Focus on key details (account status, balance, top 10 feed, or search form action, etc).`,
      },
      {
        role: "user",
        content: `Please summarize the following web page content:\n\n${content}`,
      },
    ],
    model: "gemini-2.5-flash-preview-05-20", // Using the requested Gemini model
  });

  const response = completion.choices[0]?.message?.content || "";

  //GET lAsT BRACKET IN RESPONSE
  let get_json = `{${response.substring(
    response.indexOf("{") + 1,
    response.lastIndexOf("}")
  )}
    }`;

  // console.log(response);
  console.log(";;;;", get_json);
  const _content = JSON.parse(get_json) || "";
  const actions = _content.actions as PageAction[];

  const $ = cheerio.load(content); // Load HTML content with Cheerio

  const processedActions: PageAction[] = actions.map((action) => {
    let url = action.url;

    // if URL is relative, prefix with pathBase
    if (url && !url.startsWith("http")) {
      url = new URL(url, originalUrl).href; // Convert relative URL to absolute
    }
    // Attempt to find the node - this is a simplified heuristic

    return {
      name: action.name || "Unnamed Action",
      type: action.type || "other", // Default to 'other' if type is not specified
      element_id: action.element_id || undefined, // Optional ID of the element if applicable
      element_attr_name: action.element_attr_name || undefined, // Optional attribute name of the element if applicable
      // node: foundNode,
      url: url,
    };
  });

  console.log(
    `[summarizePage] Processed ${processedActions.length} actions from the summary.`,
    processedActions
  );

  return {
    content: _content || "No summary available.",
    actions: processedActions,
    description: _content.description || "No description available.",
    html: content, // Keep original HTML if needed elsewhere
  };
}

async function main() {
  console.log(); // Add a blank line for aesthetics before intro
  intro(color.inverse(" Web Page Interactor "));

  // Graceful shutdown
  const cleanup = async () => {
    console.log("\nCleaning up before exit...");
    if (browser) {
      console.log("Closing browser context...");
      try {
        await browser.close();
        console.log("Browser context closed.");
      } catch (e) {
        console.error("Error closing browser context during cleanup:", e);
      }
    }
    process.exit(0); // Ensure the process exits after cleanup
  };

  process.on("SIGINT", async () => {
    console.log("Caught SIGINT. Cleaning up...");
    await cleanup();
  });

  process.on("SIGTERM", async () => {
    console.log("Caught SIGTERM. Cleaning up...");
    await cleanup();
  });

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
    await getPage(url); // Call getPage with the provided URL
    console.log(`Fetching content from URL: ${url}`);

    outro(color.green("Application finished successfully."));
  } catch (error) {
    console.error(
      color.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    outro(color.red("Application exited with an error."));
    if (browser) {
      console.log("Closing browser context due to error in main...");
      await browser
        .close()
        .catch((e) =>
          console.error(color.red("Error closing browser context on error:"), e)
        );
    }
    // process.exit(1); // Let cleanup handle exit
  } finally {
    await cleanup(); // Ensure cleanup runs, even on successful completion if not already exited
  }
}

async function getPage(url: string) {
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

  console.log("Summarizing page content and identifying actions...");
  const summary = await summarizePage(content, url); // summary now contains PageAction[]

  console.log("\n--- Page Summary ---");
  console.log(summary.content); // Display text summary
  console.log("--------------------");

  if (!summary.actions || summary.actions.length === 0) {
    console.log("No actions identified by the AI. Exiting.");
    process.exit(0);
  }

  // Prepare options for @clack/prompts select
  const actionOptionsForClack = summary.actions.map((action) => ({
    value: action.name, // Use description as value, assuming it's unique enough
    label: action.name,
    hint: action.type,
  }));

  const selectedActionDescription = await select({
    message: "Select a page action to perform:",
    options: actionOptionsForClack,
  });

  if (isCancel(selectedActionDescription)) {
    cancel("Operation cancelled. Exiting.");
    // await cleanup(); // Ensure cleanup is called before exiting
    throw new Error("Operation cancelled by user.");
  }

  // Find the original PageAction based on the selected description
  const selectedAction = summary.actions.find(
    (action) => action.name === selectedActionDescription
  );

  if (!selectedAction) {
    throw new Error(
      "Critical Error: Could not find the original selected action. Exiting."
    );
  }

  console.log(`\nSelected action: ${color.cyan(selectedAction.name)}`);

  if (selectedAction.type === "form") {
    let formPromptMessage = `Enter input for the form "${selectedAction.name}":`;
    let placeholderText = "Type your input here...";
    if (selectedAction.node) {
      const inputs = selectedAction.node
        .find('input[type="text"], input[type="search"], textarea')
        .first();
      const placeholder = inputs.attr("placeholder");
      const inputName = inputs.attr("name");
      if (placeholder) {
        formPromptMessage = `Enter ${placeholder}:`;
        placeholderText = placeholder;
      } else if (inputName) {
        formPromptMessage = `Enter value for ${inputName}:`;
        placeholderText = `Value for ${inputName}`;
      }
    }

    const formInput = await text({
      message: formPromptMessage,
      placeholder: placeholderText,
      validate: (value) => {
        if (!value) return "Please enter a value.";
      },
    });

    if (isCancel(formInput)) {
      cancel("Operation cancelled during form input. Exiting.");
      throw new Error("Operation cancelled during form input. Exiting.");
    }

    if (formInput) {
      // formInput is the string value directly
      console.log(
        `Input for "${color.green(selectedAction.name)}": ${color.yellow(
          formInput
        )}`
      );
    } else {
      console.log(
        `No input provided for "${color.green(selectedAction.name)}".`
      );
    }
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
