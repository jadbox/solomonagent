import TurndownService from "turndown";
import * as turndownPluginGfm from "turndown-plugin-gfm";

var turndownService = new TurndownService();
turndownService.use([
  turndownPluginGfm.tables,
  turndownPluginGfm.strikethrough,
]);

export { turndownService };
