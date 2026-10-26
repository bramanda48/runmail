export type FolderType = "system" | "custom";

/**
 * Mirrors the `folders` D1 table for API payloads. System folders are
 * permanent and cannot be deleted or renamed. For `folder_type: "system"`,
 * `name` is an i18n message key (`system.inbox`, `system.trash`, ...) rendered
 * with `t(name)`; custom folder names are user-provided text.
 */
export interface Folder {
  id: string;
  mailbox_id: string;
  name: string;
  folder_type: FolderType;
  created_at: number;
  updated_at: number;
}
