/**
 * Capability gating.
 *
 * Two independent conditions must hold before a destructive tool is registered:
 *
 *   1. The API token actually permits it (Fathom abilities: "*" or "manage:{site}").
 *   2. The operator explicitly opted in via FATHOM_ENABLE_WRITES.
 *
 * The token alone is deliberately not sufficient. A full-access key is easy to
 * paste into .env without thinking about it; arming deletion should take a second,
 * separate decision. Tools that fail either check are never registered at all --
 * an unregistered tool cannot be called by mistake, by a confused model, or by
 * prompt injection, which a runtime refusal cannot promise.
 */

import type { TokenInfo } from "./http.js";

/** Token can act on the whole account (create/delete sites, read account). */
export const hasFullAccount = (abilities: string[]): boolean => abilities.includes("*");

/** Token can modify at least one site. */
export const hasSiteWrite = (abilities: string[]): boolean =>
    abilities.some((a) => a === "*" || a.startsWith("manage:"));

/** Operator opt-in for anything that mutates data. */
export const writesEnabled = (): boolean =>
    ["1", "true", "yes"].includes((process.env.FATHOM_ENABLE_WRITES ?? "").toLowerCase());

/** Operator opt-in for irreversible deletes/wipes. Implies writesEnabled. */
export const destructiveEnabled = (): boolean =>
    writesEnabled() &&
    ["1", "true", "yes"].includes((process.env.FATHOM_ENABLE_DESTRUCTIVE ?? "").toLowerCase());

export interface Capabilities {
    token: TokenInfo | null;
    /** Non-mutating tools. Always true; reads are the baseline. */
    read: boolean;
    /** Create/update tools. */
    write: boolean;
    /** Delete/wipe tools. */
    destructive: boolean;
    /** Account-level tools (get-account, create-site, delete-site). */
    account: boolean;
    /** Human-readable reasons, logged at startup. */
    notes: string[];
}

export function resolveCapabilities(token: TokenInfo | null): Capabilities {
    const abilities = token?.abilities ?? [];
    const notes: string[] = [];

    if (!token) {
        notes.push("Could not read token metadata; registering read-only tools.");
        return { token, read: true, write: false, destructive: false, account: false, notes };
    }

    notes.push(`Token "${token.name}" abilities: ${abilities.join(", ") || "(none)"}`);
    if (!token.expires_at) notes.push("Token has no expiry.");

    const canWrite = hasSiteWrite(abilities);
    const optedIn = writesEnabled();
    const write = canWrite && optedIn;

    if (canWrite && !optedIn) {
        notes.push("Token permits writes, but FATHOM_ENABLE_WRITES is not set -- write tools omitted.");
    } else if (!canWrite) {
        notes.push("Token is read-only -- write tools omitted.");
    }

    const destructive = write && destructiveEnabled();
    if (write && !destructive) {
        notes.push("FATHOM_ENABLE_DESTRUCTIVE is not set -- delete/wipe tools omitted.");
    }

    return {
        token,
        read: true,
        write,
        destructive,
        account: hasFullAccount(abilities),
        notes,
    };
}

/**
 * Guard for irreversible operations: the caller must echo back an exact phrase.
 * A model that has not been told the precise target cannot satisfy this by accident.
 */
export function confirmationMatches(expected: string, provided: string | undefined): boolean {
    return typeof provided === "string" && provided.trim() === expected;
}
