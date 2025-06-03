// src/cliHandler.ts
import { select, text, isCancel, cancel, spinner } from "@clack/prompts";
import color from "picocolors";
import { getPageContentAndTitle, closeBrowser } from "./browserUtils";
import { summarizePage } from "./aiUtils";
import type { PageAction } from "./types";
import { fillAndSubmitForm } from "./formHandler";

export async function getPage(url: string) {
  // Validate URL format
  try {
    new URL(url);
  } catch {
    console.error("Invalid URL format. Please provide a valid URL.");
    await closeBrowser();
    process.exit(1);
  }

  console.log(`Fetching content for: ${url}`);
  const loadingSpinner = spinner();
  loadingSpinner.start("Loading page content...");
  const { title, content } = await getPageContentAndTitle(url);
  loadingSpinner.stop("Page content loaded successfully.");

  // console.log(`Page title: ${title}`);

  // console.log("Summarizing page content and identifying actions...");
  loadingSpinner.start("Summarizing page...");
  const summary = await summarizePage(content, url);
  loadingSpinner.stop("Page summary completed.");

  if (!summary.actions || summary.actions.length === 0) {
    console.log("No actions identified by the AI. Exiting.");
    await closeBrowser();
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
    await closeBrowser();
    // throw new Error("Operation cancelled by user."); // Or process.exit
    process.exit(0);
  }

  // Find the original PageAction based on the selected description
  const selectedAction = summary.actions.find(
    (action) => action.name === selectedActionDescription
  );

  if (!selectedAction) {
    // This case should ideally not be reached if summary.actions is validated
    console.error(
      "Critical Error: Could not find the original selected action. Exiting."
    );
    await closeBrowser();
    process.exit(1);
  }

  console.log(`\nSelected action: ${color.cyan(selectedAction.name)}`);

  if (selectedAction.type === "form") {
    if (!selectedAction.node) {
      console.warn(
        color.yellow(
          `Form action "${selectedAction.name}" selected, but no form node information is available. Cannot proceed.`
        )
      );
      // Optionally, ask user for next step or re-evaluate page
      await getPage(url); // Re-evaluate current page
      return;
    }
    console.log(
      "[cliHandler] Form action selected and selectedAction.node is present."
    );

    let formPromptMessage = `Enter input for the form "${selectedAction.name}":`;
    let placeholderText = "Type your input here...";

    // Extract placeholder/name from the Cheerio node for better prompt
    // console.log(
    //   "[cliHandler] Attempting to find input field in form node:",
    //   selectedAction.node.html()
    // );
    const inputs = selectedAction.node
      .find(
        'input[type="text"], input[type="search"], textarea, input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])'
      )
      .first();

    if (inputs.length > 0) {
      console.log(
        "[cliHandler] Found input field(s). First input HTML:",
        inputs.html()
      );
      const placeholder = inputs.attr("placeholder");
      const inputName = inputs.attr("name");
      console.log(
        `[cliHandler] Input placeholder: "${placeholder}", Input name: "${inputName}"`
      );
      if (placeholder) {
        formPromptMessage = `Enter ${placeholder}:`;
        placeholderText = placeholder;
      } else if (inputName) {
        formPromptMessage = `Enter value for ${inputName}:`;
        placeholderText = `Value for ${inputName}`;
      }
    } else {
      console.log(
        "[cliHandler] No suitable input field found in the form node for custom prompt. Using default prompt."
      );
    }

    console.log(
      `[cliHandler] About to call text() for prompt. Message: "${formPromptMessage}", Placeholder: "${placeholderText}"`
    );
    const formInput = await text({
      message: formPromptMessage,
      placeholder: placeholderText,
      validate: (value) => {
        // Allow empty input for forms that might accept it
        // if (!value) return "Please enter a value.";
        return undefined; // No validation for now, or make it optional
      },
    });

    if (isCancel(formInput)) {
      cancel("Operation cancelled during form input. Exiting.");
      await closeBrowser();
      process.exit(0);
    }

    // Even if formInput is an empty string, proceed if not cancelled
    console.log(
      `Input for "${color.green(selectedAction.name)}": ${color.yellow(
        formInput || "(empty)"
      )}`
    );

    const submitSpinner = spinner();
    submitSpinner.start("Submitting form and loading result...");
    try {
      const submissionResult = await fillAndSubmitForm(
        selectedAction.node,
        formInput as string, // formInput can be string | symbol, ensure it's string
        selectedAction.input_selector // Pass the direct input selector if available
      );
      submitSpinner.stop("Form submitted successfully.");
      console.log(
        color.green(`Form submitted. New page URL: ${submissionResult.url}`)
      );
      // Recursively call getPage with the new URL from submission result
      await getPage(submissionResult.url);
    } catch (error) {
      submitSpinner.stop("Form submission failed.");
      console.error(color.red("Error during form submission:"), error);
      // Decide how to proceed: retry, exit, or re-evaluate current page
      console.log(
        color.yellow("Re-evaluating current page after submission error.")
      );
      await getPage(url); // Re-evaluate current page
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
      // Re-evaluate current page as no action was taken
      await getPage(url);
    }
  } else {
    console.log(
      color.magenta(
        `Action type "${selectedAction.type}" not yet handled. Re-evaluating current page.`
      )
    );
    await getPage(url); // Re-evaluate if action type is unknown
  }
}
