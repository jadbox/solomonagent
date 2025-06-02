#!/usr/bin/env node --experimental-strip-types
import { intro, outro } from "@clack/prompts";
import color from "picocolors";
import { getPage } from "./src/cliHandler";
import { browser } from "./src/browserUtils";

async function main() {
  console.log();
  intro(color.inverse(" Web Page Interactor "));

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
    process.exit(0);
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

    if (args.length === 0) {
      console.log("Usage: bun run index.ts <url>");
      console.log("Example: bun run index.ts https://example.com");
      process.exit(1);
    }

    const url = args[0]!;
    await getPage(url);
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
  } finally {
    await cleanup();
  }
}

main();
