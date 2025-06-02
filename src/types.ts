// src/types.ts
export interface PageAction {
  name: string;
  type: "form" | "link" | "other" | string;
  url?: string; // Optional URL for the action, if applicable
  node?: any; // Changed to any as per user feedback
  element_id?: string; // Optional ID of the element if applicable
  element_attr_name?: string; // Optional attribute name of the element if applicable
}
