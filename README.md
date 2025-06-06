# Solomon's Agent: CLI interaction to a more concise web

![Screenshot 2025-06-06 124815](https://github.com/user-attachments/assets/51f7b3c7-18c1-4696-b1d5-3a59ed74d8b0)

This project provides a command-line interface (CLI) tool to quickly interact with web from the CLI. It fetches page content, summarizes it using an AI model, and allows users to select and interact with identified actions (like forms or links) on the page. This tool acts as a smart filter for the web, right in your CLI. It parses a page to surface only the essential content and the most common next steps, streamlining tasks like reading the news, researching on Wikipedia, or getting a quick weather update.

### CLI prompt a webpage:
![Screenshot 2025-06-06 120950](https://github.com/user-attachments/assets/c39722ab-c097-42a5-8fa0-3f653145fd9d)

### Interact with a simple page form:
![Screenshot 2025-06-06 121008](https://github.com/user-attachments/assets/efc81f9e-7521-4052-b501-f8077677ce1c)
![Screenshot 2025-06-06 121026](https://github.com/user-attachments/assets/41ae148f-33b2-4ccb-b46e-50f87da9e8f2)


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
    npm install
    ```
    Node Example with type stripping attribute:
    ```bash
    npm run start https://example.com
    ```


## Features

*   **Web Page Fetching:** Retrieves HTML content and title from a given URL.
*   **AI Summarization:** Uses a configured AI model (Gemini) to summarize page content concisely.
*   **Action Identification:** Identifies potential user actions (forms, links) on the page based on AI analysis.
*   **Interactive CLI:** Provides a user-friendly command-line interface to select and interact with identified page actions.
*   **Chrome Profile Detection:** [WIP] Automatically detects common Chrome user profile paths for persistent browser sessions (though currently configured for non-persistent headless mode).

## Plug
This is a silly project built while I'm looking for new opportunities around building AI-powered platforms and tools. If you're hiring, message me on https://www.linkedin.com/in/jonathandunlap/
