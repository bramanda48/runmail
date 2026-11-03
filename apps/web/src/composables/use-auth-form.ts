import { translateFieldErrors } from "@/i18n/api-errors";
import { ApiError } from "@/lib/api";
import type { Ref } from "vue";

/** Clear field/inline error refs in one call. */
export function resetFieldErrors(...errors: Array<Ref<string>>): void {
  for (const error of errors) error.value = "";
}

/**
 * Map translated validation details onto error refs.
 * `mapping` keys are server detail keys, values are the refs to fill.
 * Only sets refs with a message; returns true when anything mapped.
 */
export function mapValidationErrors(
  details: unknown,
  mapping: Record<string, Ref<string>>,
): boolean {
  const fieldErrors = translateFieldErrors(details);
  let mapped = false;
  for (const [detailKey, target] of Object.entries(mapping)) {
    const message = fieldErrors[detailKey]?.[0];
    if (message) {
      target.value = message;
      mapped = true;
    }
  }
  return mapped;
}

/** Non-ApiError or status 0 means the request never reached the API. */
export function isConnectionError(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === 0;
}
