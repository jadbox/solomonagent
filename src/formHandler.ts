import type { Page } from "playwright";
// import type { Cheerio, Element } from "cheerio"; // Using any for Cheerio types as per feedback
import { getActivePage } from "./browserUtils"; // Use getActivePage

export interface FormSubmitResult {
  title: string;
  content: string;
  url: string;
}

/**
 * Finds the most specific selector for a Cheerio element.
 * Prioritizes ID, then name, then other attributes.
 * @param element Cheerio element
 * @param tagName HTML tag name
 * @returns A CSS selector string
 */
function getSpecificSelector(
  element: any, // Use any for Cheerio type
  tagName: string
): string {
  const id = element.attr("id");
  if (id) {
    return `${tagName}#${id}`;
  }
  const name = element.attr("name");
  if (name) {
    return `${tagName}[name="${name}"]`;
  }
  // Add more attribute-based selectors if needed, e.g., class, type
  const type = element.attr("type");
  if (type) {
    return `${tagName}[type="${type}"]`;
  }
  // Fallback to just tag name, though this is weak
  return tagName;
}

export async function fillAndSubmitForm(
  formCheerioNode: any, // Cheerio node for the form, used to derive selectors
  userInput: string,
  directInputSelector?: string // Optional direct CSS selector for the input field
): Promise<FormSubmitResult> {
  const activePage = getActivePage();
  if (!activePage || activePage.isClosed()) {
    console.error(
      "[fillAndSubmitForm] Browser page is not available or closed. Please open a page first."
    );
    throw new Error(
      "Browser page not available or closed. Cannot submit form."
    );
  }

  // console.log("[fillAndSubmitForm] Attempting to fill and submit form on active page...");

  let inputSelectorToUse: string;

  if (directInputSelector) {
    // console.log(
    //   `[fillAndSubmitForm] Using direct input selector provided: "${directInputSelector}"`
    // );
    inputSelectorToUse = directInputSelector;
  } else {
    // console.log("[fillAndSubmitForm] No direct input selector. Deriving from formCheerioNode.");
    // Try to find a suitable input field within the formCheerioNode context
    const inputElementCheerio = formCheerioNode
      .find(
        'input[type="text"], input[type="search"], textarea, input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])'
      )
      .first();

    if (inputElementCheerio.length === 0) {
      console.error(
        "[fillAndSubmitForm] No suitable input field found in the form node using Cheerio."
      );
      throw new Error("No suitable input field found in the form node.");
    }
    const inputTagName = inputElementCheerio.get(0)?.tagName || "input";
    inputSelectorToUse = getSpecificSelector(inputElementCheerio, inputTagName);
    console.log(
      `[fillAndSubmitForm] Derived input selector: "${inputSelectorToUse}"`
    );
  }

  // console.log(
  //   `[fillAndSubmitForm] Attempting to fill input "${inputSelectorToUse}" with: "${userInput}"`
  // );
  await activePage.locator(inputSelectorToUse).fill(userInput);
  console.log(
    `[fillAndSubmitForm] Filled input field "${inputSelectorToUse}".`
  );

  // Attempt to find a submit button within the formCheerioNode context to click
  // Prefer specific submit buttons, then general buttons
  let submitButtonSelector: string | undefined;
  const submitButtonCheerio = formCheerioNode
    .find('button[type="submit"], input[type="submit"]')
    .first();

  if (submitButtonCheerio.length > 0) {
    const submitTagName = submitButtonCheerio.get(0)?.tagName || "button";
    submitButtonSelector = getSpecificSelector(
      submitButtonCheerio,
      submitTagName
    );
    console.log(
      `[fillAndSubmitForm] Found submit button with selector: "${submitButtonSelector}"`
    );
  } else {
    // Fallback: if no explicit submit button, try pressing Enter on the input field
    // console.log("[fillAndSubmitForm] No explicit submit button found. Will attempt to submit by pressing Enter on the input field.");
  }

  try {
    if (submitButtonSelector) {
      console.log(
        `[fillAndSubmitForm] Attempting to click submit button: "${submitButtonSelector}"`
      );
      // It's crucial to await Promise.all if the click triggers navigation.
      await Promise.all([
        activePage.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 10000,
        }),
        activePage.locator(submitButtonSelector).click(),
      ]);
      // console.log("[fillAndSubmitForm] Submit button clicked and navigation likely occurred.");
    } else {
      console.log(
        `[fillAndSubmitForm] Attempting to submit form by pressing Enter on input: ${inputSelectorToUse}`
      );
      await Promise.all([
        activePage.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 10000,
        }),
        activePage.locator(inputSelectorToUse).press("Enter"),
      ]);
      // console.log("[fillAndSubmitForm] Form submission by Enter press and navigation likely occurred.");
    }
  } catch (e: any) {
    console.warn(
      `[fillAndSubmitForm] Navigation after submit action (click or Enter) failed or timed out (e.g., SPA update): ${e.message}. Proceeding to get page state.`
    );
    // This can happen if the form submission is handled by JavaScript without a full page reload (SPA)
    // or if the timeout is too short for a slow network. We still want to get the current page state.
  }

  const newTitle = await activePage.title();
  const newContent = await activePage.content(); // Get the full HTML content
  const newUrl = activePage.url();

  console.log(
    `[fillAndSubmitForm] New page state retrieved. Title: "${newTitle}", URL: "${newUrl}"`
  );

  return {
    title: newTitle,
    content: newContent,
    url: newUrl,
  };
}
