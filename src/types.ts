// src/types.ts
export interface PageAction {
  name: string;
  type: "form" | "link" | "other" | "read" | "exit" | string;
  url?: string; // Optional URL for the action, if applicable
  node?: any; // Cheerio node, to be populated by findFormNodeInPage if type is form
  form_id?: string; // ID of the <form> element itself, if available
  form_action_value?: string; // Value of the 'action' attribute of the <form> element
  input_selector?: string; // CSS selector for the primary input/textarea within the form
}
