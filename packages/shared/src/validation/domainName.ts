import { z } from "zod";

export const DOMAIN_MAX_LENGTH = 253;
export const DOMAIN_LABEL_MAX_LENGTH = 63;

const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function isValidHostname(value: string): boolean {
  if (value.length === 0 || value.length > DOMAIN_MAX_LENGTH) return false;
  const labels = value.split(".");
  if (labels.length < 2) return false;
  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= DOMAIN_LABEL_MAX_LENGTH &&
      DOMAIN_LABEL_PATTERN.test(label)
  );
}

/**
 * Validates a domain name: labels of 1-63 chars (alphanumeric plus hyphen,
 * no leading/trailing hyphen per label), total length <= 253, at least two
 * labels. Normalizes to lowercase before validation.
 */
export const domainNameSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .refine(isValidHostname, "Invalid domain name");
