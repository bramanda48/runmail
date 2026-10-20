import type { Message } from "./message";

export const SYNC_EVENT_TYPES = [
  "message_created",
  "message_updated",
  "message_moved",
  "message_deleted",
] as const;
export type SyncEventType = (typeof SYNC_EVENT_TYPES)[number];

export interface MessageUpdatedChanges {
  is_read?: boolean;
  is_starred?: boolean;
}

export interface MessageCreatedPayload {
  message_id: string;
  sync_version: number;
  /** Full metadata snapshot of the created message. */
  message: Message;
}

export interface MessageUpdatedPayload {
  message_id: string;
  sync_version: number;
  /** Partial patch of read/star state. */
  changes: MessageUpdatedChanges;
}

export interface MessageMovedPayload {
  message_id: string;
  sync_version: number;
  folder_id: string;
  folder_entered_at: number | null;
}

export interface MessageDeletedPayload {
  message_id: string;
  sync_version: number;
}

export type SyncEventPayload =
  MessageCreatedPayload | MessageUpdatedPayload | MessageMovedPayload | MessageDeletedPayload;
