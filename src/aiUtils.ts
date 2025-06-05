// src/aiUtils.ts
import OpenAI from "openai";
import * as cheerio from "cheerio";
import type { PageAction } from "./types"; // Import the PageAction interface

import { findFormNodeInPage } from "./domUtils"; // Import the new utility

// Configure OpenAI SDK for Gemini (assuming a compatible proxy endpoint)
// IMPORTANT: You may need to change the baseURL to your specific Gemini proxy endpoint.
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", // Replace with your actual Gemini-compatible endpoint
});

export async function summarizePage(content: string, originalUrl: string) {
  // It's important that 'content' passed to findFormNodeInPage is the raw HTML, not just body text.
  // const contentBodyOnly = cheerio.load(content)("body").text().trim(); // This was for the AI prompt only.

  // const pathBase = new URL(originalUrl).pathname;
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that summarizes web page content concisely to one paragraph, 
          focusing on key page data and user actions. 
          Return as plain text the critical page information to the user as a JSON in schema:
          {
            "content": "Page summary text",
            "actions": [
              {
                "name": "action label",
                "type": "form|link",
                "url": "<URL if applicable>",
                "form_id": "<ID of the <form> element itself containing the action, if type is form>",
                "form_action_value": "<Exact value of the 'action' attribute of the <form> element, if type is form>",
                "input_selector": "<CSS selector for the primary input/textarea within the form, if type is form>"
              }
            ],
          }

          Actions are ordered 1 - 6 top key actions to take from the CLI (ranked from most common to least).
          Only links and forms that are actionable should be included. Do not include UX actions, i.e. do not add 'close panel' or 'read page'. 
          
          If search result or feed page, include the top 3 results as actions with their URLs and label with the full post or link title.
          
          For "form" type actions, the 'name' should describe the form's purpose (e.g., "Search Products", "Login").
          'form_id' should be the ID of the <form> tag itself, if it has one.
          'form_action_value' MUST be the exact value of the 'action' attribute of the <form> tag.
          'input_selector' MUST be a precise CSS selector for the main text input or textarea field within that form (e.g., 'textarea[name=\"q\"]', '.search-input').
          Prioritize providing 'form_id' or 'form_action_value' for the form, and 'input_selector' for the input.
          
          Focus on key details (account status, balance, top 10 feed, or search form action, etc).
          <think></think>`,
      },
      {
        role: "user",
        content: `Please summarize the following web page content:\n\n${(() => {
          const $ = cheerio.load(content);
          let bodyText = $("body").text().trim();
          // $("script, style, noscript, meta").remove();
          bodyText = bodyText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ""); // Remove script tags
          bodyText = bodyText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""); // Remove style tags
          // remove all empty lines and empty tags
          bodyText = bodyText.replace(/^\s*[\r\n]/gm, ""); // Remove empty lines
          bodyText = bodyText.replace(/<[^>]+>\s*<\/[^>]+>/g, ""); // Remove empty tags

          bodyText = bodyText.replace(/<br\s*\/?>/gi, " "); // Replace <br> tags with a space
          bodyText = bodyText.replace(/<[^>]+\/>/g, ""); // Remove self-closing tags
          bodyText = bodyText.replace(/\s+/g, " "); // Replace multiple spaces with a single space
          return bodyText;
        })()}`, // Use body text for AI prompt, after removing script and style tags
      },
    ],
    model: "gemini-2.0-flash", // "gemini-2.5-flash-preview-05-20", // Using the requested Gemini model
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
  const actionsFromAI = _content.actions as any[]; // Use any[] initially

  let processedActions: PageAction[] = actionsFromAI.map((actionFromAI) => {
    // // console.log("[summarizePage] Processing AI action:", JSON.stringify(actionFromAI)); // Log each action from AI
    let url = actionFromAI.url;
    let foundNode: any | undefined = undefined;

    // if URL is relative, prefix with pathBase
    if (url && !url.trim().startsWith("http")) {
      url = new URL(url.trim(), originalUrl).href; // Convert relative URL to absolute
    }

    if (actionFromAI.type === "form") {
      // console.log(`[summarizePage] Action "${actionFromAI.name}" is type form. Calling findFormNodeInPage.`);
      foundNode = findFormNodeInPage(actionFromAI, content); // Pass the full HTML 'content'
    } else {
      // console.log(`[summarizePage] Action "${actionFromAI.name}" is type "${actionFromAI.type}". Skipping findFormNodeInPage.`);
    }

    const finalAction: PageAction = {
      name: actionFromAI.name,
      type: actionFromAI.type,
      form_id: actionFromAI.form_id, // Use new field name
      form_action_value: actionFromAI.form_action_value, // Use new field name
      input_selector: actionFromAI.input_selector, // Use new field name
      node: foundNode, // Assign the found Cheerio node (which should be the form element)
      url: url,
    };
    // // console.log("[summarizePage] Created PageAction object:", JSON.stringify({
    //   name: finalAction.name,
    //   type: finalAction.type,
    //   form_id: finalAction.form_id,
    //   form_action_value: finalAction.form_action_value,
    //   input_selector: finalAction.input_selector,
    //   nodeId: finalAction.node ? "SET" : "NOT_SET",
    // }));
    return finalAction;
  });

  // push "read" action to beginning of list
  processedActions.push({
    name: "Read Full Page",
    type: "read",
    url: "",
  });

  // console.log(
  //   `[summarizePage] Processed ${processedActions.length} actions from the summary.`,
  //   processedActions
  // );

  return {
    raw: content,
    airesponse: _content || "No summary available.",
    actions: processedActions,
    description: _content.content || "No description available.",
    html: content, // Keep original HTML if needed elsewhere
  };
}
