import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FathomApi } from "@mackenly/fathom-api";
import { attempt, compact } from "../lib/output.js";
import { siteId } from "../lib/ids.js";

export function registerVisitorsTool(server: McpServer, client: FathomApi): void {
    server.tool(
        "get-current-visitors",
        "Get the number of visitors currently on a Fathom Analytics site",
        {
            site_id: siteId(),
            detailed: z
                .boolean()
                .optional()
                .describe("Include top content and referrer breakdowns"),
        },
        ({ site_id, detailed = false }) =>
            attempt(
                () => client.api.reports.currentVisitors({ site_id, detailed }),
                (data) =>
                    compact({
                        site_id,
                        total: data.total,
                        content: detailed ? data.content : undefined,
                        referrers: detailed ? data.referrers : undefined,
                    }),
            ),
    );
}
