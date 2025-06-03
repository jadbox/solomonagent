#!/usr/bin/env node --experimental-strip-types
import { intro, outro } from "@clack/prompts";
import color from "picocolors";
import { getPage } from "./src/cliHandler";
import { closeBrowser } from "./src/browserUtils"; // Import closeBrowser

async function main() {
  console.log();
  intro(color.inverse(" Web Page Interactor "));

  const cleanup = async (exitCode = 0) => {
    console.log("\nCleaning up before exit...");
    try {
      await closeBrowser(); // Use the new closeBrowser function
    } catch (e) {
      console.error(color.red("Error during browser cleanup:"), e);
    }
    console.log("Cleanup finished.");
    process.exit(exitCode);
  };

  // Setup signal handlers
  process.on("SIGINT", async () => {
    console.log("\nCaught SIGINT. Cleaning up...");
    await cleanup(0); // Pass exit code
  });

  process.on("SIGTERM", async () => {
    console.log("\nCaught SIGTERM. Cleaning up...");
    await cleanup(0); // Pass exit code
  });

  if (!process.env.GEMINI_API_KEY) {
    console.error("Please set the GEMINI_API_KEY environment variable.");
    await cleanup(1); // Exit with error code
  }

  try {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log("Usage: bun run index.ts <url>");
      console.log("Example: bun run index.ts https://example.com");
      await cleanup(1); // Exit with error code
    }

    const url = args[0]!;
    // console.log(`Fetching content from URL: ${url}`); // getPage will log this
    await getPage(url);

    outro(color.green("Application finished successfully."));
    await cleanup(0); // Normal exit
  } catch (error) {
    console.error(
      color.red(
        `\nUnhandled Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
    if (error instanceof Error && error.stack) {
      console.error(color.gray(error.stack));
    }
    outro(color.red("Application exited with an error."));
    await cleanup(1); // Exit with error code
  }
  // The 'finally' block is removed as cleanup is called explicitly in try/catch paths
}

main().catch(async (e) => {
  // Catch any unhandled promise rejections from main itself
  console.error(color.red("Critical unhandled error in main execution:"), e);
  // Ensure cleanup is called even in this extreme case
  const { closeBrowser: emergencyClose } = await import("./src/browserUtils");
  try {
    await emergencyClose();
  } catch (closeError) {
    console.error(color.red("Emergency browser close failed:"), closeError);
  }
  process.exit(1);
});
