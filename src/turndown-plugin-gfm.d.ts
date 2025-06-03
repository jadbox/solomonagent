// src/turndown-plugin-gfm.d.ts
import type TurndownService from "turndown";

declare module "turndown-plugin-gfm" {
  export const tables: (service: TurndownService) => void;
  export const strikethrough: (service: TurndownService) => void;
}
