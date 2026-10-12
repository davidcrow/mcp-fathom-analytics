import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FathomApi } from "@mackenly/fathom-api";
import { FathomHttp, type TokenInfo } from "./lib/http.js";
import { resolveCapabilities } from "./lib/guards.js";
import { registerAccountTools } from "./tools/account.js";
import { registerSitesTools } from "./tools/sites.js";
import { registerEventsTools } from "./tools/events.js";
import { registerMilestonesTools } from "./tools/milestones.js";
import { registerAggregationTool } from "./tools/aggregation.js";
import { registerVisitorsTool } from "./tools/visitors.js";

// Your Fathom Analytics API key should be provided via environment variable
const API_KEY = process.env.FATHOM_API_KEY || "";

const server = new McpServer({
    name: "fathom-analytics",
    version: "1.1.0",
});

async function main() {
    if (!API_KEY || API_KEY.length === 0) {
        console.error("Error: FATHOM_API_KEY environment variable is not set.");
        console.error("Please set this variable to your Fathom Analytics API key.");
        process.exit(1);
    }

    const fathomClient = new FathomApi({ token: API_KEY });
    const http = new FathomHttp(API_KEY);

    // Ask the API what this token may actually do, so tools the token cannot use
    // are never registered. A failure here degrades to read-only rather than
    // aborting -- reads are the baseline and should keep working offline of /token.
    let token: TokenInfo | null = null;
    try {
        token = await http.request<TokenInfo>("GET", "/token");
    } catch (error) {
        console.error(
            `Warning: could not read token metadata (${error instanceof Error ? error.message : String(error)}).`,
        );
    }

    const caps = resolveCapabilities(token);
    for (const note of caps.notes) console.error(`  ${note}`);

    registerAccountTools(server, fathomClient, http, caps);
    registerSitesTools(server, fathomClient, caps);
    registerEventsTools(server, fathomClient, caps);
    registerMilestonesTools(server, http, caps);
    registerAggregationTool(server, fathomClient);
    registerVisitorsTool(server, fathomClient);

    const tiers = [
        "read",
        caps.write ? "write" : null,
        caps.destructive ? "destructive" : null,
        caps.account ? "account" : null,
    ].filter(Boolean);
    console.error(`Fathom Analytics MCP Server running on stdio [${tiers.join(", ")}]`);

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
