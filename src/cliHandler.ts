// src/cliHandler.ts
import { select, text, isCancel, cancel } from "@clack/prompts";
import color from "picocolors";
import { getPageContentAndTitle } from "./browserUtils";
import { summarizePage } from "./aiUtils";
import type { PageAction } from "./types";

export async function getPage(url: string) {
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

  // console.log("\n--- Page Summary ---");
  // console.log(summary.actions); // Display text summary
  // console.log("--------------------");

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
    message: summary.description, //"Select a page action to perform:",
    options: actionOptionsForClack,
  });

  if (isCancel(selectedActionDescription)) {
    cancel("Operation cancelled. Exiting.");
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
  } else if (selectedAction.type === "link") {
    if (selectedAction.url) {
      console.log(color.blue(`Following link to: ${selectedAction.url}`));
      await getPage(selectedAction.url); // Recursive call to process the new page
    } else {
      console.warn(
        color.yellow(
          "Link action selected, but no URL was provided. Cannot follow link."
        )
      );
    }
  }
}
