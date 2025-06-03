// src/domUtils.ts
import * as cheerio from "cheerio";

/**
 * Attempts to find a form element in the given HTML content based on AI-provided action details.
 * @param actionDetails Object containing element_id, element_attr_name, and name.
 * @param htmlContent The full HTML content of the page.
 * @returns The Cheerio element for the found form, or undefined.
 */
export function findFormNodeInPage(
  actionDetails: any,
  htmlContent: string
): any | undefined {
  const $ = cheerio.load(htmlContent);
  // Ensure actionDetails is not null and has properties before destructuring
  if (!actionDetails) {
    console.error(
      "[findFormNodeInPage] ERROR: actionDetails is null or undefined."
    );
    return undefined;
  }
  // Use form_id and form_action_value as per the new plan
  const {
    form_id,
    form_action_value,
    name: actionName,
    input_selector,
  } = actionDetails;

  // console.log(
  //   `[findFormNodeInPage] ENTERED. actionDetails: ${JSON.stringify(
  //     actionDetails
  //   )}`
  // );
  // console.log(
  //   `[findFormNodeInPage] Attempting to find form for action: "${actionName}", form_id: "${form_id}", form_action_value: "${form_action_value}", input_selector: "${input_selector}"`
  // );

  // Helper to check if element is a form and return it
  const getFormElement = (
    element: any,
    method: string,
    value: string
  ): any | undefined => {
    if (element && element.length > 0 && element.is("form")) {
      console.log(
        `[findFormNodeInPage] SUCCESS: Found form via ${method}: "${value}".`
      );
      return element.first();
    }
    if (element && element.length > 0) {
      console.log(
        `[findFormNodeInPage] Element found via ${method}: "${value}" (tag: ${element.prop(
          "tagName"
        )}) is not a form.`
      );
    } else {
      console.log(
        `[findFormNodeInPage] No element found via ${method}: "${value}".`
      );
    }
    return undefined;
  };

  // 1. Try by form_id
  if (form_id) {
    // console.log(`[findFormNodeInPage] Trying form by ID: #${form_id}`);
    const formElement = $(`#${form_id}`);
    const foundForm = getFormElement(formElement, "form_id", form_id);
    if (foundForm) {
      return foundForm;
    }
  } else {
    console.log(`[findFormNodeInPage] form_id not provided.`);
  }

  // 2. Try by form_action_value
  if (form_action_value) {
    // console.log(
    //   `[findFormNodeInPage] Trying form by action attribute: form[action="${form_action_value}"]`
    // );
    // Ensure we select only form elements with the specified action
    const formElement = $(`form[action="${form_action_value}"]`);
    const foundForm = getFormElement(
      formElement,
      "form_action_value",
      form_action_value
    );
    if (foundForm) {
      return foundForm;
    }
  } else {
    console.log(`[findFormNodeInPage] form_action_value not provided.`);
  }

  // 3. Try finding via input_selector (if AI provides it and other methods failed)
  if (input_selector) {
    // console.log(
    //   `[findFormNodeInPage] Fallback: Trying to find form via input_selector: "${input_selector}"`
    // );
    const inputElement = $(input_selector);
    if (inputElement.length > 0) {
      // The selector might point to the input itself or a container.
      // Find the actual input/textarea/select if the selector points to a container.
      let actualInteractiveElement = inputElement;
      if (!inputElement.is("input, textarea, select")) {
        actualInteractiveElement = inputElement
          .find("input, textarea, select")
          .first();
      }

      if (actualInteractiveElement.length > 0) {
        const parentForm = actualInteractiveElement.closest("form");
        if (parentForm.length > 0) {
          console.log(
            `[findFormNodeInPage] SUCCESS: Found form via input_selector's parent form.`
          );
          return parentForm.first();
        } else {
          console.log(
            `[findFormNodeInPage] No parent form found for element matched by input_selector: "${input_selector}".`
          );
        }
      } else {
        console.log(
          `[findFormNodeInPage] No interactive input/textarea/select element found within or at input_selector: "${input_selector}".`
        );
      }
    } else {
      console.log(
        `[findFormNodeInPage] No element found for input_selector: "${input_selector}".`
      );
    }
  }

  console.warn(
    `[findFormNodeInPage] FAILED to find form for action: "${actionName}". Searched by form_id: "${form_id}", form_action_value: "${form_action_value}", and input_selector: "${input_selector}".`
  );
  return undefined;
}
