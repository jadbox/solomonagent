# Web Page Interactor

This project provides a command-line interface (CLI) tool to interact with web pages. It fetches page content, summarizes it using an AI model, and allows users to select and interact with identified actions (like forms or links) on the page.

## Project Structure

The project is organized into a modular structure for better maintainability and scalability:

```
.
├── src/
│   ├── types.ts            # Defines shared TypeScript interfaces (e.g., PageAction).
│   ├── browserUtils.ts     # Handles Playwright browser automation and Chrome profile detection.
│   ├── aiUtils.ts          # Contains logic for AI-powered page summarization using OpenAI/Gemini.
│   └── cliHandler.ts       # Manages all command-line user interactions using @clack/prompts.
├── index.ts                # The main entry point, orchestrating the application flow.
├── package.json            # Project metadata and dependencies.
├── tsconfig.json           # TypeScript configuration.
├── .gitignore              # Specifies intentionally untracked files to ignore.
└── README.md               # Project documentation.
```

## How to Run

1.  **Set up Environment Variable:**
    Ensure you have your Gemini API key set as an environment variable:
    `export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"`

2.  **Install Dependencies:**
    ```bash
    bun install
    ```

3.  **Run the Application:**
    ```bash
    bun run index.ts <url>
    ```
    Node Example with type stripping attribute:
    ```bash
    yarn run start https://example.com
    ```
    Bun Example:
    ```bash
    bun run index.ts https://example.com
    ```

## Features

*   **Web Page Fetching:** Retrieves HTML content and title from a given URL.
*   **AI Summarization:** Uses a configured AI model (Gemini) to summarize page content concisely.
*   **Action Identification:** Identifies potential user actions (forms, links) on the page based on AI analysis.
*   **Interactive CLI:** Provides a user-friendly command-line interface to select and interact with identified page actions.
*   **Chrome Profile Detection:** Automatically detects common Chrome user profile paths for persistent browser sessions (though currently configured for non-persistent headless mode).
