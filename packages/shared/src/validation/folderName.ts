import { z } from "zod";

export const FOLDER_NAME_MIN_LENGTH = 1;
export const FOLDER_NAME_MAX_LENGTH = 64;

export const RESERVED_FOLDER_NAMES: readonly string[] = [
  "inbox",
  "draft",
  "sent",
  "spam",
  "archive",
  "trash"
];

/**
 * Reserved system folder names are matched case-insensitively. The reserved
 * system-folder name check is a separate concern from shape validation because
 * it must run in the context of a mailbox.
 */
export function isReservedFolderName(name: string): boolean {
  return RESERVED_FOLDER_NAMES.includes(name.trim().toLowerCase());
}

// Single source of truth for system folder names: identical to
// RESERVED_FOLDER_NAMES, aliased so service code reads intent.
export const SYSTEM_FOLDER_NAMES = RESERVED_FOLDER_NAMES;

/** Case-insensitive system-folder name check. */
export function isSystemFolder(name: string): boolean {
  return isReservedFolderName(name);
}

export const folderNameSchema = z
  .string()
  .refine(
    (value) => value === value.trim(),
    "Folder name must not have leading or trailing whitespace"
  )
  .trim()
  .min(FOLDER_NAME_MIN_LENGTH, "Folder name is required")
  .max(FOLDER_NAME_MAX_LENGTH, `Folder name must be at most ${FOLDER_NAME_MAX_LENGTH} characters`);
