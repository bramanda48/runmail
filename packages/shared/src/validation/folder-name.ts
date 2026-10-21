import { z } from "zod";

export const FOLDER_NAME_MIN_LENGTH = 1;
export const FOLDER_NAME_MAX_LENGTH = 64;

/**
 * System folders persist i18n message keys in `folders.name`; the frontend
 * renders them with `t(folder.name)`.
 */
export const SYSTEM_FOLDER_KEYS = [
  "system.inbox",
  "system.draft",
  "system.sent",
  "system.archive",
  "system.spam",
  "system.trash",
] as const;

export type SystemFolderKey = (typeof SYSTEM_FOLDER_KEYS)[number];

/** Pre-i18n literal names stay reserved so custom folders never collide. */
const LEGACY_SYSTEM_FOLDER_NAMES = ["inbox", "draft", "sent", "spam", "archive", "trash"] as const;

export const RESERVED_FOLDER_NAMES: readonly string[] = [
  ...SYSTEM_FOLDER_KEYS,
  ...LEGACY_SYSTEM_FOLDER_NAMES,
];

/**
 * Reserved names are matched case-insensitively. The `system.` prefix is
 * always reserved to keep the key namespace free for system folders. The
 * reserved-name check is a separate concern from shape validation because it
 * must run in the context of a mailbox.
 */
export function isReservedFolderName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.startsWith("system.") || RESERVED_FOLDER_NAMES.includes(normalized);
}

/** Case-insensitive system-folder key check. */
export function isSystemFolderKey(name: string): name is SystemFolderKey {
  const normalized = name.trim().toLowerCase();
  return (SYSTEM_FOLDER_KEYS as readonly string[]).includes(normalized);
}

export const folderNameSchema = z
  .string()
  .refine((value) => value === value.trim(), "validation.folderName.noOuterWhitespace")
  .trim()
  .min(FOLDER_NAME_MIN_LENGTH, "validation.folderName.required")
  .max(FOLDER_NAME_MAX_LENGTH, "validation.folderName.max");
