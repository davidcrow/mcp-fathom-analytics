/**
 * Structured JSON output helpers.
 *
 * Tools return JSON rather than hand-formatted prose so the model parses results
 * unambiguously, and so fields that are absent from the API are simply missing
 * rather than rendered as the string "undefined".
 */

export type ToolResult = {
    content: { type: "text"; text: string }[];
    isError?: boolean;
};

const asText = (value: unknown): ToolResult["content"] => [
    { type: "text", text: JSON.stringify(value, null, 2) },
];

/** A successful tool result. */
export function ok(data: unknown): ToolResult {
    return { content: asText(data) };
}

/** A failed tool result. Flagged with isError so the client can distinguish it. */
export function fail(error: string, extra: Record<string, unknown> = {}): ToolResult {
    return { content: asText({ error, ...extra }), isError: true };
}

/**
 * Drop keys whose value is undefined, so absent API fields are omitted entirely
 * instead of serialising as null. Fathom legitimately returns null (e.g. an event
 * with no currency), and that is preserved -- only undefined is stripped.
 */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
}

/**
 * Run an API call and wrap the outcome in a ToolResult.
 *
 * Error messages from the Fathom client carry only a status and a message -- never
 * request headers -- so the bearer token cannot reach a tool response through here.
 */
export async function attempt<T>(
    call: () => Promise<T>,
    shape: (value: T) => unknown,
): Promise<ToolResult> {
    try {
        return ok(shape(await call()));
    } catch (error) {
        const status = (error as { status?: number })?.status;
        const message = error instanceof Error ? error.message : String(error);
        return fail(message, status !== undefined ? { status } : {});
    }
}
