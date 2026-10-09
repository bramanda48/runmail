import { describe, expect, it } from "bun:test";
import type { LocalFolder, LocalMessage, MailboxDb } from "../../apps/web/src/db/mailbox-db";
import { computeUnreadCounts } from "../../apps/web/src/lib/unread-counts";

let idSeq = 0;

function makeFolder(overrides: Partial<LocalFolder> & { id: string }): LocalFolder {
  return {
    folder_type: "custom",
    name: overrides.id,
    updated_at: 0,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<LocalMessage> & { folder_id: string }): LocalMessage {
  idSeq += 1;
  return {
    email_date: 0,
    folder_entered_at: null,
    from_address: "a@example.com",
    from_name: null,
    id: `msg-${idSeq}`,
    is_read: false,
    is_starred: false,
    received_at: 0,
    snippet: "",
    subject: "",
    sync_version: 1,
    to_addresses: [],
    updated_at: 0,
    ...overrides,
  };
}

/** Structural fake of the Dexie surface used by computeUnreadCounts (no IndexedDB needed). */
function fakeDb(folders: LocalFolder[], messages: LocalMessage[]): MailboxDb {
  return {
    folders: {
      toArray: async () => folders,
    },
    messages: {
      where: (field: string) => ({
        equals: (folderId: string) => ({
          and: (predicate: (m: LocalMessage) => boolean) => ({
            count: async () =>
              messages.filter(
                (m) =>
                  (m as unknown as Record<string, unknown>)[field] === folderId && predicate(m),
              ).length,
          }),
        }),
      }),
    },
  } as unknown as MailboxDb;
}

describe("computeUnreadCounts", () => {
  it("returns an empty object when there are no folders", async () => {
    expect(await computeUnreadCounts(fakeDb([], []))).toEqual({});
  });

  it("returns 0 for a folder without messages", async () => {
    const db = fakeDb([makeFolder({ id: "inbox" })], []);
    expect(await computeUnreadCounts(db)).toEqual({ inbox: 0 });
  });

  it("counts only unread messages per folder", async () => {
    const db = fakeDb(
      [makeFolder({ id: "inbox" }), makeFolder({ id: "archive" })],
      [
        makeMessage({ folder_id: "inbox", is_read: false }),
        makeMessage({ folder_id: "inbox", is_read: false }),
        makeMessage({ folder_id: "inbox", is_read: true }),
        makeMessage({ folder_id: "archive", is_read: true }),
      ],
    );
    expect(await computeUnreadCounts(db)).toEqual({ archive: 0, inbox: 2 });
  });

  it("returns 0 for every folder when all messages are read", async () => {
    const db = fakeDb(
      [makeFolder({ id: "inbox" }), makeFolder({ id: "sent" })],
      [
        makeMessage({ folder_id: "inbox", is_read: true }),
        makeMessage({ folder_id: "sent", is_read: true }),
      ],
    );
    expect(await computeUnreadCounts(db)).toEqual({ inbox: 0, sent: 0 });
  });

  it("does not leak counts across folders", async () => {
    const db = fakeDb(
      [makeFolder({ id: "a" }), makeFolder({ id: "b" })],
      [
        makeMessage({ folder_id: "a", is_read: false }),
        makeMessage({ folder_id: "a", is_read: false }),
        makeMessage({ folder_id: "a", is_read: false }),
        makeMessage({ folder_id: "b", is_read: false }),
      ],
    );
    expect(await computeUnreadCounts(db)).toEqual({ a: 3, b: 1 });
  });
});
