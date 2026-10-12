import { z } from "zod";

/**
 * Validated identifier schemas for anything interpolated into an API path.
 *
 * Two separate reasons this has to happen at the schema layer:
 *
 *   1. @mackenly/fathom-api does not encode path parameters -- it interpolates
 *      them straight into template literals (dist/index.js:273-394). A value
 *      containing "/" therefore injects arbitrary path segments.
 *   2. encodeURIComponent is not sufficient on its own. It escapes "/" but not
 *      ".", so a parameter of exactly ".." still collapses a path segment once
 *      the URL is normalised: /sites/../milestones resolves to /milestones.
 *
 * Either one lets a caller redirect a request to an endpoint the capability
 * gating intended to withhold -- e.g. update-event (write tier) reaching
 * POST /v1/sites (create-site, account tier) via event_id = "../..".
 *
 * Fathom identifiers are alphanumeric tracking codes (CDBUGS, ABCDEFGH) or
 * UUIDs, so restricting to [A-Za-z0-9_-] rejects every traversal payload while
 * accepting every legitimate value. Call sites still apply encodeURIComponent
 * as defence in depth.
 */
const IDENTIFIER = /^[A-Za-z0-9_-]+$/;

const identifier = (label: string, description: string) =>
    z
        .string()
        .min(1)
        .max(64)
        .regex(IDENTIFIER, `${label} must contain only letters, numbers, hyphens, and underscores`)
        .describe(description);

export const siteId = (description = "ID of the site, e.g. CDBUGS") =>
    identifier("site_id", description);

export const eventId = (description = "ID (tracking code) of the event, e.g. ABCDEFGH") =>
    identifier("event_id", description);

export const milestoneId = (description = "UUID of the milestone") =>
    identifier("milestone_id", description);
