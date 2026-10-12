# MCP Fathom Analytics

An unofficial Model Context Protocol ([MCP](https://modelcontextprotocol.io/introduction)) server for accessing [Fathom Analytics](https://usefathom.com/) data through an AI assistant. This implementation uses the [@mackenly/fathom-api](https://github.com/mackenly/fathom-api) unofficial SDK to interact with the Fathom Analytics API. Not affiliated, endorsed, or supported by Fathom Analytics. Published to [npm as an npx script](https://www.npmjs.com/package/mcp-fathom-analytics).

[![smithery badge](https://smithery.ai/badge/@mackenly/mcp-fathom-analytics)](https://smithery.ai/server/@mackenly/mcp-fathom-analytics)

<p float="left">
<a href="https://glama.ai/mcp/servers/56cxbakbc4" width="33%">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/56cxbakbc4/badge" alt="Fathom Analytics MCP server" />
</a> 
<a href="https://mseep.ai/app/mackenly-mcp-fathom-analytics" width="33%">
  <img width="200" src="https://mseep.net/pr/mackenly-mcp-fathom-analytics-badge.png" alt="MseeP.ai Security Assessment Badge" />
</a>
</p>

## Features

The MCP server provides the following Fathom Analytics tools. All tools return
structured JSON.

Which tools are registered depends on what your API token is allowed to do and on
two opt-in environment variables — see [Capability gating](#capability-gating).

### Always available (read-only)
- `get-token`: Metadata about the API token in use, including its abilities and expiry (the secret value is never returned)
- `list-sites`: List all sites in the account
- `get-site`: Get a single site by ID
- `list-events`: List events for a site
- `get-event`: Get a single event
- `list-milestones`: List milestones for a site
- `get-milestone`: Get a single milestone
- `get-aggregation`: Aggregated analytics reports with filtering and grouping
- `get-current-visitors`: Real-time data about current site visitors

### Requires a full-access (`*`) token
- `get-account`: Details about your Fathom Analytics account

### Requires `FATHOM_ENABLE_WRITES=1`
- `create-site` (also needs `*`), `update-site`
- `create-event`, `update-event`
- `create-milestone`, `update-milestone`

### Requires `FATHOM_ENABLE_WRITES=1` *and* `FATHOM_ENABLE_DESTRUCTIVE=1`
These are irreversible. Each also requires an exact confirmation string.
- `delete-site` (also needs `*`), `wipe-site-data` (also needs `*`)
- `delete-event`, `wipe-event-data`
- `delete-milestone`

## Capability gating

At startup the server calls `GET /token` and registers only the tools your token
can actually use. Destructive tools additionally require explicit opt-in via
environment variable — a full-access token on its own is *not* enough.

This is deliberate. Tools that fail either check are never registered, and an
unregistered tool cannot be invoked by a mistaken call, a confused model, or
prompt injection — something a runtime refusal cannot promise. With no opt-in
vars set, a full-access token still yields a read-only server.

```
                         read   write   destructive
read-only token            ✓       —          —
full-access token          ✓       —          —
  + FATHOM_ENABLE_WRITES   ✓       ✓          —
  + ..._ENABLE_DESTRUCTIVE ✓       ✓          ✓
```

### Known Fathom API limitation

Fathom's OpenAPI spec documents an `id` field on event objects, but the live API
does not return one. `list-events` therefore omits the key rather than reporting
a bogus value, and `get-aggregation` with `entity: "event"` cannot be used, since
there is no way to obtain a valid event `entity_id`. If Fathom begins sending the
field, it will appear automatically with no code change.

## Usage
If you're using Claude Desktop, you can add the MCP server using the json config ([more info](https://modelcontextprotocol.io/quickstart/user)). Here's an example:
```json
{
    "mcpServers": {
        "fathom-analytics": {
            "command": "npx",
            "args": [
                "-y",
                "mcp-fathom-analytics"
            ],
            "env": {
                "FATHOM_API_KEY": "your_api_key_here"
            }
        }
    }
}
```

You can find more information about other MCP Clients here: [Model Context Protocol Example Clients](https://modelcontextprotocol.io/clients)

## API Structure

The MCP server uses the [@mackenly/fathom-api](https://github.com/mackenly/fathom-api) SDK to interface with the Fathom Analytics API endpoints:

1. **Account API**: `https://api.usefathom.com/v1/account`
2. **Sites API**: `https://api.usefathom.com/v1/sites`
3. **Events API**: `https://api.usefathom.com/v1/sites/SITE_ID/events`
4. **Aggregation API**: `https://api.usefathom.com/v1/aggregations`
5. **Current Visitors API**: `https://api.usefathom.com/v1/current_visitors`

## Aggregation Examples

The aggregation tool is highly flexible. Here are some example use cases:

1. **Daily pageview statistics for the last 30 days**:
```json
{
  "entity": "pageview",
  "entity_id": "SITE_ID",
  "aggregates": "pageviews,uniques,visits",
  "date_grouping": "day",
  "date_from": "2023-08-01 00:00:00"
}
```

2. **Performance of individual pages**:
```json
{
  "entity": "pageview",
  "entity_id": "SITE_ID",
  "aggregates": "pageviews,uniques,avg_duration",
  "field_grouping": "pathname",
  "sort_by": "pageviews:desc",
  "limit": 10
}
```

3. **Traffic from specific countries**:
```json
{
  "entity": "pageview",
  "entity_id": "SITE_ID",
  "aggregates": "visits",
  "field_grouping": "country_code",
  "sort_by": "visits:desc"
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
