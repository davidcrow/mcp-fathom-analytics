import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FathomApi } from "@mackenly/fathom-api";
import { attempt, compact, fail } from "../lib/output.js";
import { confirmationMatches, type Capabilities } from "../lib/guards.js";
import { siteId } from "../lib/ids.js";

const SHARING = ["none", "private", "public"] as const;

const shapeSite = (site: Record<string, unknown>) =>
    compact({
        id: site.id,
        name: site.name,
        sharing: site.sharing,
        created_at: site.created_at,
    });

export function registerSitesTools(
    server: McpServer,
    client: FathomApi,
    caps: Capabilities,
): void {
    server.tool(
        "list-sites",
        "List all sites in the Fathom Analytics account (handles pagination)",
        {
            limit: z.number().positive().optional().describe("Max number of sites to return"),
        },
        ({ limit }) =>
            attempt(
                () => client.api.getAllSites(limit),
                (sites) => ({ count: sites.length, sites: sites.map(shapeSite as never) }),
            ),
    );

    server.tool(
        "get-site",
        "Get a single Fathom Analytics site by ID",
        { site_id: siteId() },
        ({ site_id }) => attempt(() => client.api.sites.get(site_id), shapeSite as never),
    );

    if (caps.write && caps.account) {
        server.tool(
            "create-site",
            "Create a new site in the Fathom Analytics account",
            {
                name: z.string().max(255).describe("Name of the website (up to 255 characters)"),
                sharing: z.enum(SHARING).optional().describe("Sharing configuration"),
                share_password: z
                    .string()
                    .optional()
                    .describe("Password, required when sharing is 'private'"),
            },
            (params) =>
                attempt(() => client.api.sites.create(params as never), shapeSite as never),
        );
    }

    if (caps.write) {
        server.tool(
            "update-site",
            "Update an existing Fathom Analytics site",
            {
                site_id: siteId("ID of the site to update"),
                name: z.string().max(255).optional().describe("New name for the website"),
                sharing: z.enum(SHARING).optional().describe("Sharing configuration"),
                share_password: z
                    .string()
                    .optional()
                    .describe("Password, required when sharing is 'private'"),
            },
            ({ site_id, ...params }) =>
                attempt(
                    () => client.api.sites.update(site_id, params as never),
                    shapeSite as never,
                ),
        );
    }

    // Irreversible. Registered only when the token allows it AND both opt-in env
    // vars are set. Each additionally requires the caller to echo an exact phrase.
    if (caps.destructive && caps.account) {
        server.tool(
            "delete-site",
            "PERMANENTLY delete a site and all of its analytics data. Irreversible.",
            {
                site_id: siteId("ID of the site to delete"),
                confirm: z
                    .string()
                    .describe("Must be exactly: DELETE SITE <site_id>"),
            },
            ({ site_id, confirm }) => {
                const expected = `DELETE SITE ${site_id}`;
                if (!confirmationMatches(expected, confirm)) {
                    return Promise.resolve(
                        fail(`Confirmation mismatch. To proceed, confirm must be exactly "${expected}".`),
                    );
                }
                return attempt(() => client.api.sites.delete(site_id), shapeSite as never);
            },
        );

        server.tool(
            "wipe-site-data",
            "PERMANENTLY erase all analytics data for a site, keeping the site itself. Irreversible.",
            {
                site_id: siteId("ID of the site to wipe"),
                confirm: z.string().describe("Must be exactly: WIPE SITE <site_id>"),
            },
            ({ site_id, confirm }) => {
                const expected = `WIPE SITE ${site_id}`;
                if (!confirmationMatches(expected, confirm)) {
                    return Promise.resolve(
                        fail(`Confirmation mismatch. To proceed, confirm must be exactly "${expected}".`),
                    );
                }
                return attempt(() => client.api.sites.wipe(site_id), shapeSite as never);
            },
        );
    }
}
