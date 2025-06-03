import type { Page, BrowserContext } from "playwright";
// import type { Cheerio, Element } from "cheerio"; // Using any for Cheerio types as per feedback
import { browser, page } from "./browserUtils"; // Assuming browser and page are exported

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
  formCheerioNode: any, // Cheerio node for the form
  userInput: string,
  directInputSelector?: string // Optional direct CSS selector for the input field
): Promise<FormSubmitResult> {
  if (!browser || !page || page.isClosed()) {
    // console.error("[fillAndSubmitForm] Browser or page not initialized or closed.");
    throw new Error("Browser or page not initialized or closed.");
  }

  // console.log("[fillAndSubmitForm] Attempting to fill and submit form...");

  // Determine the Playwright form element
  // This still relies on formCheerioNode to get a selector for the form itself,
  // as directInputSelector is only for the input *within* the form.
  const formTagName = formCheerioNode.get(0)?.tagName || "form";
  const formSelectorForPlaywright = getSpecificSelector(
    formCheerioNode,
    formTagName
  );
  // console.log(`[fillAndSubmitForm] Using form selector for Playwright context: ${formSelectorForPlaywright}`);
  const playwrightFormElement = page.locator(formSelectorForPlaywright).first();

  let finalInputSelectorForPlaywright: string;

  if (directInputSelector) {
    // console.log(`[fillAndSubmitForm] Using direct input selector provided by AI: "${directInputSelector}"`);
    finalInputSelectorForPlaywright = directInputSelector;
    // We will fill this directly using page.locator(directInputSelector) if it's global,
    // or playwrightFormElement.locator(directInputSelector) if it's relative to the form.
    // For simplicity and robustness, let's assume directInputSelector is specific enough to be global or Playwright handles context.
    // A safer bet is to locate it within the form context if the selector isn't globally unique.
    // However, the AI is prompted for a selector *within the form*.
    // console.log(`[fillAndSubmitForm] Attempting to fill input with selector: "${finalInputSelectorForPlaywright}"`);
    await page.locator(finalInputSelectorForPlaywright);
    await page.locator(finalInputSelectorForPlaywright).fill(userInput);
    // console.log(`[fillAndSubmitForm] Filled input field using direct selector "${finalInputSelectorForPlaywright}" within form "${formSelectorForPlaywright}" with: "${userInput}"`);
  } else {
    // console.log("[fillAndSubmitForm] No direct input selector provided. Finding input via Cheerio within formCheerioNode.");
    const inputElementCheerio = formCheerioNode
      .find(
        'input[type="text"], input[type="search"], textarea, input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])'
      )
      .first();
    if (inputElementCheerio.length === 0) {
      // console.error("[fillAndSubmitForm] No suitable input field found in the provided form node using Cheerio.");
      throw new Error(
        "No suitable input field found in the provided form node using Cheerio."
      );
    }
    const inputTagName = inputElementCheerio.get(0)?.tagName || "input";
    finalInputSelectorForPlaywright = getSpecificSelector(
      inputElementCheerio,
      inputTagName
    );
    // console.log(`[fillAndSubmitForm] Using Cheerio-derived input selector: ${finalInputSelectorForPlaywright}`);
    // console.log(`[fillAndSubmitForm] Attempting to fill input with selector: "${finalInputSelectorForPlaywright}"`);
    await page.locator(finalInputSelectorForPlaywright);
    await page.locator(finalInputSelectorForPlaywright).fill(userInput);
    // console.log(`[fillAndSubmitForm] Filled input field "${finalInputSelectorForPlaywright}" within form "${formSelectorForPlaywright}" with: "${userInput}"`);
  }

  // 3. Submit the form by pressing "Enter" on the input field.
  try {
    // console.log(`[fillAndSubmitForm] Attempting to submit form by pressing Enter on input: ${finalInputSelectorForPlaywright}`);
    await page.locator(finalInputSelectorForPlaywright).press("Enter");

    // Wait for navigation after the action
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 15000, // Increased timeout
    });
    // console.log("[fillAndSubmitForm] Form submission by Enter press action complete and navigation occurred.");
  } catch (e) {
    // console.warn("[fillAndSubmitForm] Pressing Enter on input field or subsequent navigation failed. Error:", e);
  }

  const newTitle = await page.title();
  const newContent = await page.content();
  const newUrl = page.url();

  // console.log(`[fillAndSubmitForm] New page loaded. Title: ${newTitle}, URL: ${newUrl}`);

  return {
    title: newTitle,
    content: newContent,
    url: newUrl,
  };
}
