import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FathomApi } from "@mackenly/fathom-api";
import { attempt, compact } from "../lib/output.js";
import type { Capabilities } from "../lib/guards.js";
import type { FathomHttp, TokenInfo } from "../lib/http.js";

export function registerAccountTools(
    server: McpServer,
    client: FathomApi,
    http: FathomHttp,
    caps: Capabilities,
): void {
    // GET /account requires full account access ("*"). Registering it with a
    // read-only token just hands the model a tool that always returns 400.
    if (caps.account) {
        server.tool(
            "get-account",
            "Get Fathom Analytics account information (requires a full-access token)",
            {},
            () =>
                attempt(
                    () => client.api.account.get(),
                    (account) =>
                        compact({
                            id: account.id,
                            name: account.name,
                            email: account.email,
                        }),
                ),
        );
    }

    // Available to any valid token, and useful for diagnosing why a tool is absent.
    server.tool(
        "get-token",
        "Get metadata about the API token in use, including its abilities and expiry. The secret value is never returned.",
        {},
        () =>
            attempt(
                () => http.request<TokenInfo>("GET", "/token"),
                (token) =>
                    compact({
                        name: token.name,
                        abilities: token.abilities,
                        expires_at: token.expires_at,
                        last_used_at: token.last_used_at,
                        created_at: token.created_at,
                    }),
            ),
    );
}
