import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FathomApi, AggregationParams } from "@mackenly/fathom-api";
import { attempt } from "../lib/output.js";

export function registerAggregationTool(server: McpServer, client: FathomApi): void {
    server.tool(
        "get-aggregation",
        "Get aggregated analytics data from Fathom. Note: entity='event' requires an event ID, which Fathom's events endpoint does not currently return -- only entity='pageview' is reliably usable.",
        {
            entity: z.enum(["pageview", "event"]).describe("The entity to aggregate"),
            entity_id: z.string().describe("ID of the entity (site ID, or event ID)"),
            aggregates: z
                .string()
                .describe(
                    "Comma-separated aggregates: visits,uniques,pageviews,avg_duration,bounce_rate,conversions,unique_conversions,value",
                ),
            date_grouping: z.enum(["hour", "day", "month", "year"]).optional().describe("Date grouping"),
            field_grouping: z.string().optional().describe("Comma-separated fields to group by, e.g. hostname,pathname"),
            sort_by: z.string().optional().describe("Field to sort by, e.g. pageviews:desc"),
            timezone: z.string().optional().describe("Timezone for date calculations (default UTC)"),
            date_from: z.string().describe("Start date, e.g. 2025-01-01 or 2025-01-01 00:00:00"),
            date_to: z.string().describe("End date, e.g. 2025-12-31 or 2025-12-31 23:59:59"),
            limit: z.number().positive().optional().describe("Limit on number of results"),
            filters: z
                .array(
                    z.object({
                        property: z.string(),
                        operator: z.enum(["is", "is not", "is like", "is not like"]),
                        value: z.string(),
                    }),
                )
                .optional()
                .describe("Array of filter objects"),
        },
        (params: AggregationParams) =>
            attempt(
                () => client.api.reports.aggregation(params),
                (data) => {
                    const rows = Array.isArray(data) ? data.filter(Boolean) : [];
                    return {
                        entity: params.entity,
                        entity_id: params.entity_id,
                        count: rows.length,
                        results: rows,
                    };
                },
            ),
    );
}
