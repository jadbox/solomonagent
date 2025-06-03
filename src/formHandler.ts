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
    await playwrightFormElement
      .locator(finalInputSelectorForPlaywright)
      .fill(userInput);
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
    await playwrightFormElement
      .locator(finalInputSelectorForPlaywright)
      .fill(userInput);
    // console.log(`[fillAndSubmitForm] Filled input field "${finalInputSelectorForPlaywright}" within form "${formSelectorForPlaywright}" with: "${userInput}"`);
  }

  // 2. Find the submit button (logic remains similar, uses playwrightFormElement for context)
  let submitButtonPlaywrightLocator;
  const submitButtonCheerio = formCheerioNode
    .find('button[type="submit"], input[type="submit"]')
    .first();

  if (submitButtonCheerio.length > 0) {
    const submitTagName = submitButtonCheerio.get(0)?.tagName || "button";
    const submitButtonSelector = getSpecificSelector(
      submitButtonCheerio,
      submitTagName
    );
    // console.log(`[fillAndSubmitForm] Found submit button with selector: ${submitButtonSelector}`);
    submitButtonPlaywrightLocator = playwrightFormElement
      .locator(submitButtonSelector)
      .first(); // Ensure we target the first match
  } else {
    // Fallback: try to find any submit button within the form if specific one not found by Cheerio
    // console.log("[fillAndSubmitForm] No specific submit button found by Cheerio, trying generic submit locators.");
    submitButtonPlaywrightLocator = playwrightFormElement
      .locator('button[type="submit"], input[type="submit"]')
      .first(); // Ensure we target the first match
  }

  // 3. Click the submit button or submit the form
  try {
    // console.log("[fillAndSubmitForm] Attempting to click submit button...");
    // The .first() above should handle the strict mode violation by ensuring we only try to click one.
    // No need to check count explicitly here if .first() is used, as it will error if no element is found by .first()
    if (!submitButtonPlaywrightLocator) {
      // Should not happen if logic above is sound
      // console.error("[fillAndSubmitForm] CRITICAL: submitButtonPlaywrightLocator is undefined before click attempt.");
      throw new Error("Submit button locator was not defined.");
    }

    // Check if the locator (which is now .first()) actually points to an element before clicking
    if ((await submitButtonPlaywrightLocator.count()) === 0) {
      // console.warn("[fillAndSubmitForm] Submit button locator (.first()) did not find an element. Attempting Enter press.");
      // This is a Playwright direct DOM manipulation, might not trigger all JS handlers
      // await playwrightFormElement.evaluate(form => (form as HTMLFormElement).submit());
      // A better fallback is pressing Enter on the input field
      // console.log("[fillAndSubmitForm] Attempting to submit form by pressing Enter on the input field.");
      // Use finalInputSelectorForPlaywright, located within the form context
      await playwrightFormElement
        .locator(finalInputSelectorForPlaywright)
        .press("Enter");
    } else {
      await submitButtonPlaywrightLocator.click();
    }

    // Wait for navigation after the action
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
    // console.log("[fillAndSubmitForm] Form submission action complete and navigation occurred.");
  } catch (e) {
    // console.warn("[fillAndSubmitForm] Clicking submit button or pressing Enter failed. Error:", e);
    // If click/Enter fails, it might be a SPA that doesn't do a full navigation.
    // Or the navigation might have already completed very quickly.
    // We can try to check if URL changed or content updated.
    // For now, we assume navigation was expected.
    // If `waitForNavigation` times out, it means no traditional navigation happened.
    // The page might have updated via JS. In this case, we just proceed.
    // console.log("[fillAndSubmitForm] Proceeding after potential submission error, assuming page might have updated via JS.");
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
