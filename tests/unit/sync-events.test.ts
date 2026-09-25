import { describe, expect, it } from "bun:test";
import type { LocalMessage } from "../../apps/web/src/db/mailbox-db";
import { applySyncEvent, type EventTables, type SyncEvent } from "../../apps/web/src/sync/events";

function makeTables(seed: LocalMessage[] = []): {
  tables: EventTables;
  store: Map<string, LocalMessage>;
} {
  const store = new Map<string, LocalMessage>(seed.map((m) => [m.id, { ...m }]));
  const tables: EventTables = {
    getMessage: async (id) => store.get(id),
    putMessage: async (msg) => {
      store.set(msg.id, { ...msg });
    },
    updateMessage: async (id, changes) => {
      const existing = store.get(id);
      if (existing) store.set(id, { ...existing, ...changes });
    },
    deleteMessage: async (id) => {
      store.delete(id);
    },
  };
  return { tables, store };
}

function baseMessage(overrides: Partial<LocalMessage> = {}): LocalMessage {
  return {
    id: "m1",
    from_name: "Alice",
    from_address: "alice@example.com",
    to_addresses: ["bob@example.com"],
    subject: "Hi",
    snippet: "Hello",
    email_date: 1000,
    received_at: 1001,
    is_read: false,
    is_starred: false,
    folder_id: "inbox",
    folder_entered_at: 1001,
    sync_version: 1,
    updated_at: 1001,
    ...overrides,
  };
}

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    from_name: "Alice",
    from_address: "alice@example.com",
    to_addresses: ["bob@example.com"],
    subject: "Hi",
    snippet: "Hello",
    email_date: 1000,
    received_at: 1001,
    is_read: false,
    is_starred: false,
    folder_id: "inbox",
    folder_entered_at: 1001,
    sync_version: 7,
    ...overrides,
  };
}

describe("applySyncEvent", () => {
  it("message_created puts the full snapshot (overwrite semantics)", async () => {
    const { tables, store } = makeTables([baseMessage({ subject: "Old" })]);
    const event: SyncEvent = {
      sync_version: 7,
      event_type: "message_created",
      message_id: "m1",
      payload: { message_id: "m1", sync_version: 7, message: snapshot() },
    };
    await applySyncEvent(tables, event);
    const row = store.get("m1");
    expect(row).toMatchObject({
      id: "m1",
      subject: "Hi",
      to_addresses: ["bob@example.com"],
      folder_entered_at: 1001,
      sync_version: 7,
    });
  });

  it("message_updated applies changes to the existing row", async () => {
    const { tables, store } = makeTables([baseMessage()]);
    await applySyncEvent(tables, {
      sync_version: 8,
      event_type: "message_updated",
      message_id: "m1",
      payload: { message_id: "m1", changes: { is_read: true, is_starred: true } },
    });
    expect(store.get("m1")).toMatchObject({ is_read: true, is_starred: true, sync_version: 8 });
  });

  it("message_updated ignores a missing row silently", async () => {
    const { tables, store } = makeTables();
    await applySyncEvent(tables, {
      sync_version: 8,
      event_type: "message_updated",
      message_id: "ghost",
      payload: { message_id: "ghost", changes: { is_read: true } },
    });
    expect(store.has("ghost")).toBe(false);
  });

  it("message_moved updates folder fields", async () => {
    const { tables, store } = makeTables([baseMessage()]);
    await applySyncEvent(tables, {
      sync_version: 9,
      event_type: "message_moved",
      message_id: "m1",
      payload: { message_id: "m1", folder_id: "trash", folder_entered_at: 2000 },
    });
    expect(store.get("m1")).toMatchObject({
      folder_id: "trash",
      folder_entered_at: 2000,
      sync_version: 9,
    });
  });

  it("message_deleted removes the row", async () => {
    const { tables, store } = makeTables([baseMessage()]);
    await applySyncEvent(tables, {
      sync_version: 10,
      event_type: "message_deleted",
      message_id: "m1",
      payload: { message_id: "m1" },
    });
    expect(store.has("m1")).toBe(false);
  });

  it("ignores unknown event types", async () => {
    const { tables, store } = makeTables([baseMessage()]);
    await applySyncEvent(tables, {
      sync_version: 11,
      event_type: "message_reacted",
      message_id: "m1",
      payload: { message_id: "m1" },
    });
    expect(store.get("m1")).toMatchObject({ subject: "Hi", sync_version: 1 });
  });

  it("skips malformed payloads without throwing", async () => {
    const { tables, store } = makeTables([baseMessage()]);
    const bad: SyncEvent[] = [
      { sync_version: 1, event_type: "message_created", message_id: "m1", payload: null },
      { sync_version: 1, event_type: "message_created", message_id: "m1", payload: {} },
      {
        sync_version: 1,
        event_type: "message_created",
        message_id: "m1",
        payload: { message: { subject: "no required fields" } },
      },
      { sync_version: 1, event_type: "message_updated", message_id: "m1", payload: {} },
      {
        sync_version: 1,
        event_type: "message_updated",
        message_id: "m1",
        payload: { changes: {} },
      },
      { sync_version: 1, event_type: "message_moved", message_id: "m1", payload: {} },
    ];
    for (const event of bad) {
      await applySyncEvent(tables, event);
    }
    expect(store.get("m1")).toMatchObject({ subject: "Hi", folder_id: "inbox", sync_version: 1 });
  });
});
