import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { attempt, compact, fail } from "../lib/output.js";
import { siteId } from "../lib/ids.js";
import type { FathomHttp } from "../lib/http.js";

const FIELD_GROUPINGS = [
    "hostname", "pathname", "entry_page", "exit_page", "referrer_hostname",
    "referrer_pathname", "referrer_source", "ai_source", "browser", "country_code",
    "city", "state", "region", "device_type", "operating_system", "utm_campaign",
    "utm_content", "utm_medium", "utm_source", "utm_term", "keyword", "ref",
] as const;

/**
 * Goes through the raw HTTP client rather than @mackenly/fathom-api: the library
 * validates aggregation params against an older contract that requires entity_id
 * and strips site_id/entity_name, which makes name-addressed event aggregation
 * impossible through it.
 */
export function registerAggregationTool(server: McpServer, http: FathomHttp): void {
    server.tool(
        "get-aggregation",
        [
            "Get aggregated analytics data from Fathom.",
            "For pageviews: set entity='pageview' and entity_id=<site id>.",
            "For events: set entity='event', site_id=<site id> and entity_name=<event name>.",
            "Events are addressed by NAME, not by ID -- do not pass entity_id for events.",
            "Pageview aggregates: visits, uniques, pageviews, avg_duration, bounce_rate.",
            "Event aggregates: conversions, unique_conversions, value (value is in cents).",
        ].join(" "),
        {
            entity: z.enum(["pageview", "event"]).describe("What to report on"),
            entity_id: siteId("Site ID. Required when entity='pageview'. Do not use for events.").optional(),
            site_id: siteId("Site the event belongs to. Required when entity='event'.").optional(),
            entity_name: z
                .string()
                .optional()
                .describe("Name of the event, e.g. 'Book New'. Required when entity='event'."),
            aggregates: z
                .string()
                .describe(
                    "Comma-separated. Pageview: visits,uniques,pageviews,avg_duration,bounce_rate. Event: conversions,unique_conversions,value",
                ),
            date_grouping: z.enum(["hour", "day", "month", "year"]).optional()
                .describe("Group results by period. Omit for a single total."),
            field_grouping: z
                .string()
                .optional()
                .describe(`Comma-separated fields to group by. Supported: ${FIELD_GROUPINGS.join(", ")}`),
            sort_by: z.string().optional().describe("Sort as field:asc or field:desc, e.g. pageviews:desc"),
            date_from: z.string().optional().describe("Start timestamp, e.g. 2026-09-01 00:00:00"),
            date_to: z.string().optional().describe("End timestamp, e.g. 2026-09-30 23:59:59"),
            limit: z.number().int().min(1).max(1000).optional().describe("1-1000"),
            filters: z
                .array(
                    z.object({
                        property: z.string(),
                        operator: z.enum(["is", "is not", "is like", "is not like"]),
                        value: z.string(),
                    }),
                )
                .optional()
                .describe(
                    "Array of filter objects. Values are case-sensitive and must match the API's casing exactly (e.g. 'Desktop', 'Phone', 'Tablet' -- not 'desktop'). Group by the field first to discover its exact values.",
                ),
        },
        (params) => {
            // Fathom addresses events by name and pageviews by site id. Catching the
            // mismatch here gives a usable message instead of an opaque API rejection.
            if (params.entity === "event") {
                if (!params.site_id || !params.entity_name) {
                    return Promise.resolve(
                        fail("entity='event' requires both site_id and entity_name (the event's name, e.g. 'Book New'). Event IDs are not used."),
                    );
                }
                if (params.entity_id) {
                    return Promise.resolve(
                        fail("Do not pass entity_id when entity='event'. Use site_id and entity_name instead."),
                    );
                }
            } else if (!params.entity_id) {
                return Promise.resolve(fail("entity='pageview' requires entity_id (the site ID)."));
            }

            const query = compact({
                entity: params.entity,
                entity_id: params.entity_id,
                site_id: params.site_id,
                entity_name: params.entity_name,
                aggregates: params.aggregates,
                date_grouping: params.date_grouping,
                field_grouping: params.field_grouping,
                sort_by: params.sort_by,
                date_from: params.date_from,
                date_to: params.date_to,
                limit: params.limit,
                filters: params.filters,
            });

            return attempt(
                () =>
                    http.request<unknown>("GET", "/aggregations", {
                        query: {
                            ...query,
                            // Fathom expects filters as a JSON-encoded query string value.
                            filters: params.filters ? JSON.stringify(params.filters) : undefined,
                        },
                    }),
                (data) => {
                    const rows = Array.isArray(data) ? data.filter(Boolean) : [];
                    return compact({
                        entity: params.entity,
                        site_id: params.site_id ?? params.entity_id,
                        entity_name: params.entity_name,
                        count: rows.length,
                        results: rows,
                    });
                },
            );
        },
    );
}
