// src/aiUtils.ts
import OpenAI from "openai";
import * as cheerio from "cheerio";
import type { PageAction } from "./types"; // Import the PageAction interface

// Configure OpenAI SDK for Gemini (assuming a compatible proxy endpoint)
// IMPORTANT: You may need to change the baseURL to your specific Gemini proxy endpoint.
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", // Replace with your actual Gemini-compatible endpoint
});

export async function summarizePage(content: string, originalUrl: string) {
  // const pathBase = new URL(originalUrl).pathname;
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that summarizes web page content concisely to 2 sentances, 
          focusing on key page data and user actions. 
          Return as plain text the critical page information to the user as a JSON in schema:
          {
            "content": "Page summary text",
            "actions": [
              {
                "name": "action label",
                "type": "form|link|button",
                "url": "<URL if applicable>",
                "element_id": "<ID of the element if applicable>",
                "element_attr_name": "<Attribute name of the element if applicable>"
              }
            ],
          }

          Actions are ordered 1 - 10 top key actions 
          (ranked from most common to least).
          
          Focus on key details (account status, balance, top 10 feed, or search form action, etc).`,
      },
      {
        role: "user",
        content: `Please summarize the following web page content:\n\n${content}`,
      },
    ],
    model: "gemini-2.5-flash-preview-05-20", // Using the requested Gemini model
  });

  const response = completion.choices[0]?.message?.content || "";

  //GET lAsT BRACKET IN RESPONSE
  let get_json = `{${response.substring(
    response.indexOf("{") + 1,
    response.lastIndexOf("}")
  )}
    }`;

  // console.log(";;;;", get_json);
  const _content = JSON.parse(get_json) || "";
  const actions = _content.actions as PageAction[];

  // const $ = cheerio.load(content); // Load HTML content with Cheerio

  const processedActions: PageAction[] = actions.map((action) => {
    let url = action.url;

    // if URL is relative, prefix with pathBase
    if (url && !url.trim().startsWith("http")) {
      url = new URL(url.trim(), originalUrl).href; // Convert relative URL to absolute
    }
    // Attempt to find the node - this is a simplified heuristic

    return {
      name: action.name,
      type: action.type, // Default to 'other' if type is not specified
      element_id: action.element_id, // Optional ID of the element if applicable
      element_attr_name: action.element_attr_name, // Optional attribute name of the element if applicable
      // node: foundNode,
      url: url,
    };
  });

  // console.log(
  //   `[summarizePage] Processed ${processedActions.length} actions from the summary.`,
  //   processedActions
  // );

  return {
    content: _content || "No summary available.",
    actions: processedActions,
    description: _content.description || "No description available.",
    html: content, // Keep original HTML if needed elsewhere
  };
}
