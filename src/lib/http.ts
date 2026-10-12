/**
 * Minimal authenticated HTTP client for the Fathom endpoints that
 * @mackenly/fathom-api does not cover: milestones and the token endpoint.
 *
 * Everything else goes through the library. This exists only to fill the gap.
 */

const BASE_URL = "https://api.usefathom.com/v1";

export class FathomHttpError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
        this.name = "FathomHttpError";
    }
}

export class FathomHttp {
    constructor(private readonly token: string) {}

    async request<T>(
        method: "GET" | "POST" | "DELETE",
        path: string,
        options: { query?: Record<string, unknown>; body?: unknown } = {},
    ): Promise<T> {
        const url = new URL(BASE_URL + path);
        for (const [key, value] of Object.entries(options.query ?? {})) {
            if (value !== undefined) url.searchParams.set(key, String(value));
        }

        const response = await fetch(url.toString(), {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

        const raw = await response.text();
        let parsed: unknown = null;
        if (raw) {
            try {
                parsed = JSON.parse(raw);
            } catch {
                parsed = raw;
            }
        }

        if (!response.ok) {
            const body = parsed as { error?: string; message?: string } | null;
            // Deliberately never includes the request headers, so the bearer token
            // cannot leak into an error surfaced back through a tool response.
            throw new FathomHttpError(
                body?.error ?? body?.message ?? `HTTP ${response.status}`,
                response.status,
            );
        }

        return parsed as T;
    }
}

export interface TokenInfo {
    name: string;
    version: number;
    abilities: string[];
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Milestone {
    id: string;
    object: "milestone";
    name: string;
    milestone_date: string;
    created_at: string;
    updated_at: string;
}

export interface ListResponse<T> {
    object: "list";
    url: string;
    has_more: boolean;
    data: T[];
}
