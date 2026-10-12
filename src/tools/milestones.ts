import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { attempt, compact, fail } from "../lib/output.js";
import { confirmationMatches, type Capabilities } from "../lib/guards.js";
import { milestoneId, siteId } from "../lib/ids.js";
import type { FathomHttp, ListResponse, Milestone } from "../lib/http.js";

/** Milestones are absent from @mackenly/fathom-api, so these go over raw HTTP. */
const shapeMilestone = (m: Partial<Milestone>) =>
    compact({
        id: m.id,
        name: m.name,
        milestone_date: m.milestone_date,
        created_at: m.created_at,
        updated_at: m.updated_at,
    });

export function registerMilestonesTools(
    server: McpServer,
    http: FathomHttp,
    caps: Capabilities,
): void {
    server.tool(
        "list-milestones",
        "List milestones for a Fathom Analytics site",
        {
            site_id: siteId(),
            limit: z.number().positive().optional().describe("Max number of milestones to return"),
        },
        ({ site_id, limit }) =>
            attempt(
                () =>
                    http.request<ListResponse<Milestone>>(
                        "GET",
                        `/sites/${encodeURIComponent(site_id)}/milestones`,
                        { query: { limit } },
                    ),
                (res) => ({
                    site_id,
                    count: res.data.length,
                    has_more: res.has_more,
                    milestones: res.data.map(shapeMilestone),
                }),
            ),
    );

    server.tool(
        "get-milestone",
        "Get a single milestone for a Fathom Analytics site",
        {
            site_id: siteId(),
            milestone_id: milestoneId(),
        },
        ({ site_id, milestone_id }) =>
            attempt(
                () =>
                    http.request<Milestone>(
                        "GET",
                        `/sites/${encodeURIComponent(site_id)}/milestones/${encodeURIComponent(milestone_id)}`,
                    ),
                shapeMilestone,
            ),
    );

    if (caps.write) {
        server.tool(
            "create-milestone",
            "Create a milestone on a Fathom Analytics site",
            {
                site_id: siteId(),
                name: z.string().max(30).describe("Name of the milestone (up to 30 characters)"),
                milestone_date: z.string().describe("Date of the milestone, e.g. 2024-01-15"),
            },
            ({ site_id, ...body }) =>
                attempt(
                    () =>
                        http.request<Milestone>(
                            "POST",
                            `/sites/${encodeURIComponent(site_id)}/milestones`,
                            { body },
                        ),
                    shapeMilestone,
                ),
        );

        server.tool(
            "update-milestone",
            "Update an existing milestone on a Fathom Analytics site",
            {
                site_id: siteId(),
                milestone_id: milestoneId("UUID of the milestone to update"),
                name: z.string().max(30).optional().describe("New name for the milestone"),
                milestone_date: z.string().optional().describe("New date, e.g. 2024-01-20"),
            },
            ({ site_id, milestone_id, ...body }) =>
                attempt(
                    () =>
                        http.request<Milestone>(
                            "POST",
                            `/sites/${encodeURIComponent(site_id)}/milestones/${encodeURIComponent(milestone_id)}`,
                            { body },
                        ),
                    shapeMilestone,
                ),
        );
    }

    if (caps.destructive) {
        server.tool(
            "delete-milestone",
            "PERMANENTLY delete a milestone from a site. Irreversible.",
            {
                site_id: siteId(),
                milestone_id: milestoneId("UUID of the milestone to delete"),
                confirm: z.string().describe("Must be exactly: DELETE MILESTONE <milestone_id>"),
            },
            ({ site_id, milestone_id, confirm }) => {
                const expected = `DELETE MILESTONE ${milestone_id}`;
                if (!confirmationMatches(expected, confirm)) {
                    return Promise.resolve(
                        fail(`Confirmation mismatch. To proceed, confirm must be exactly "${expected}".`),
                    );
                }
                return attempt(
                    () =>
                        http.request<Milestone>(
                            "DELETE",
                            `/sites/${encodeURIComponent(site_id)}/milestones/${encodeURIComponent(milestone_id)}`,
                        ),
                    shapeMilestone,
                );
            },
        );
    }
}
