export type FolderType = "system" | "custom";

/**
 * Mirrors the `folders` D1 table for API payloads. System folders are
 * permanent and cannot be deleted or renamed.
 */
export interface Folder {
  id: string;
  mailbox_id: string;
  name: string;
  folder_type: FolderType;
  created_at: number;
  updated_at: number;
}
