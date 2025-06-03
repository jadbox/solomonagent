// src/turndown-plugin-gfm.d.ts
import type TurndownService from "turndown";

export const tables: (service: TurndownService) => void;
export const strikethrough: (service: TurndownService) => void;
