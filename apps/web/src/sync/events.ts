import type { LocalMessage } from "@/db/mailbox-db";

/** Minimal table surface so event application is unit-testable without Dexie. */
export interface EventTables {
  getMessage(id: string): Promise<LocalMessage | undefined>;
  putMessage(msg: LocalMessage): Promise<void>;
  updateMessage(id: string, changes: Partial<LocalMessage>): Promise<void>;
  deleteMessage(id: string): Promise<void>;
}

export type SyncEvent = {
  sync_version: number;
  event_type: string;
  message_id: string;
  payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Applies one backend sync event to the local tables.
 * Unknown event types are ignored (forward compatibility); malformed
 * payloads are skipped defensively.
 */
export async function applySyncEvent(tables: EventTables, event: SyncEvent): Promise<void> {
  if (!isRecord(event.payload)) return;
  const payload = event.payload;

  switch (event.event_type) {
    case "message_created": {
      if (!isRecord(payload.message)) return;
      const snap = payload.message;
      const fromAddress = asString(snap.from_address);
      const subject = asString(snap.subject);
      const snippet = asString(snap.snippet);
      const emailDate = asNumber(snap.email_date);
      const receivedAt = asNumber(snap.received_at);
      const folderId = asString(snap.folder_id);
      if (
        fromAddress === null ||
        subject === null ||
        snippet === null ||
        emailDate === null ||
        receivedAt === null ||
        folderId === null
      ) {
        return;
      }
      const folderEnteredAt = asNumber(snap.folder_entered_at);
      const syncVersion = asNumber(snap.sync_version) ?? event.sync_version;
      const fromName = asString(snap.from_name);
      await tables.putMessage({
        id: event.message_id,
        from_name: fromName,
        from_address: fromAddress,
        to_addresses: asStringArray(snap.to_addresses),
        subject,
        snippet,
        email_date: emailDate,
        received_at: receivedAt,
        is_read: asBoolean(snap.is_read, false),
        is_starred: asBoolean(snap.is_starred, false),
        folder_id: folderId,
        folder_entered_at: folderEnteredAt,
        sync_version: syncVersion,
        updated_at: Date.now(),
      });
      return;
    }
    case "message_updated": {
      if (!isRecord(payload.changes)) return;
      const patch: Partial<LocalMessage> = {
        sync_version: event.sync_version,
        updated_at: Date.now(),
      };
      if (typeof payload.changes.is_read === "boolean") patch.is_read = payload.changes.is_read;
      if (typeof payload.changes.is_starred === "boolean") {
        patch.is_starred = payload.changes.is_starred;
      }
      if (patch.is_read === undefined && patch.is_starred === undefined) return;
      // The row may be missing locally (e.g. created before a pruning gap).
      const existing = await tables.getMessage(event.message_id);
      if (!existing) return;
      await tables.updateMessage(event.message_id, patch);
      return;
    }
    case "message_moved": {
      const folderId = asString(payload.folder_id);
      if (folderId === null) return;
      await tables.updateMessage(event.message_id, {
        folder_id: folderId,
        folder_entered_at: asNumber(payload.folder_entered_at),
        sync_version: event.sync_version,
        updated_at: Date.now(),
      });
      return;
    }
    case "message_deleted": {
      await tables.deleteMessage(event.message_id);
      return;
    }
    default: {
      // Unknown event_type: ignore for forward compatibility.
      return;
    }
  }
}
