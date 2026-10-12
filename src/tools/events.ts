import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FathomApi } from "@mackenly/fathom-api";
import { attempt, compact, fail } from "../lib/output.js";
import { confirmationMatches, type Capabilities } from "../lib/guards.js";

const CURRENCIES = ["dollar", "pound", "euro", "yuan", "peso", "shekel"] as const;

/**
 * Fathom's OpenAPI spec documents an `id` on event objects, but the live API does
 * not return one (verified across 271 events). compact() therefore omits the key
 * entirely rather than emitting "undefined". If Fathom starts sending it, it will
 * appear here automatically with no code change.
 */
const shapeEvent = (event: Record<string, unknown>) =>
    compact({
        id: event.id,
        name: event.name,
        currency: event.currency,
        created_at: event.created_at,
    });

export function registerEventsTools(
    server: McpServer,
    client: FathomApi,
    caps: Capabilities,
): void {
    server.tool(
        "list-events",
        "List all events for a Fathom Analytics site (handles pagination). Note: Fathom's API does not currently return event IDs, so results cannot be used as entity_id for get-aggregation.",
        {
            site_id: z.string().describe("ID of the site to retrieve events for"),
            limit: z.number().positive().optional().describe("Max number of events to return"),
        },
        ({ site_id, limit }) =>
            attempt(
                () => client.api.getAllEvents(site_id, limit),
                (events) => ({
                    site_id,
                    count: events.length,
                    events: events.map(shapeEvent as never),
                }),
            ),
    );

    server.tool(
        "get-event",
        "Get a single event for a Fathom Analytics site",
        {
            site_id: z.string().describe("ID of the site"),
            event_id: z.string().describe("ID (tracking code) of the event, e.g. ABCDEFGH"),
        },
        ({ site_id, event_id }) =>
            attempt(() => client.api.events(site_id).get(event_id), shapeEvent as never),
    );

    if (caps.write) {
        server.tool(
            "create-event",
            "Create a new event on a Fathom Analytics site",
            {
                site_id: z.string().describe("ID of the site"),
                name: z.string().max(255).describe("Name of the event (up to 255 characters)"),
                currency: z.enum(CURRENCIES).optional().describe("Currency for event value"),
            },
            ({ site_id, ...params }) =>
                attempt(
                    () => client.api.events(site_id).create(params as never),
                    shapeEvent as never,
                ),
        );

        server.tool(
            "update-event",
            "Update an existing event on a Fathom Analytics site",
            {
                site_id: z.string().describe("ID of the site"),
                event_id: z.string().describe("ID of the event to update"),
                name: z.string().max(255).optional().describe("New name for the event"),
                currency: z.enum(CURRENCIES).optional().describe("Currency for event value"),
            },
            ({ site_id, event_id, ...params }) =>
                attempt(
                    () => client.api.events(site_id).update(event_id, params as never),
                    shapeEvent as never,
                ),
        );
    }

    // Irreversible. See sites.ts for the gating rationale.
    if (caps.destructive) {
        server.tool(
            "delete-event",
            "PERMANENTLY delete an event and its data from a site. Irreversible.",
            {
                site_id: z.string().describe("ID of the site"),
                event_id: z.string().describe("ID of the event to delete"),
                confirm: z.string().describe("Must be exactly: DELETE EVENT <event_id>"),
            },
            ({ site_id, event_id, confirm }) => {
                const expected = `DELETE EVENT ${event_id}`;
                if (!confirmationMatches(expected, confirm)) {
                    return Promise.resolve(
                        fail(`Confirmation mismatch. To proceed, confirm must be exactly "${expected}".`),
                    );
                }
                return attempt(
                    () => client.api.events(site_id).delete(event_id),
                    shapeEvent as never,
                );
            },
        );

        server.tool(
            "wipe-event-data",
            "PERMANENTLY erase all recorded data for an event, keeping the event itself. Irreversible.",
            {
                site_id: z.string().describe("ID of the site"),
                event_id: z.string().describe("ID of the event to wipe"),
                confirm: z.string().describe("Must be exactly: WIPE EVENT <event_id>"),
            },
            ({ site_id, event_id, confirm }) => {
                const expected = `WIPE EVENT ${event_id}`;
                if (!confirmationMatches(expected, confirm)) {
                    return Promise.resolve(
                        fail(`Confirmation mismatch. To proceed, confirm must be exactly "${expected}".`),
                    );
                }
                return attempt(
                    () => client.api.events(site_id).wipe(event_id),
                    shapeEvent as never,
                );
            },
        );
    }
}
