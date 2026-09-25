import { describe, expect, it } from "bun:test";
import type { MessageDetail } from "../../apps/web/src/lib/api";
import { toLocalMessage } from "../../apps/web/src/sync/mapping";

function detail(overrides: Partial<MessageDetail> = {}): MessageDetail {
  return {
    id: "m1",
    mailbox_id: "mb1",
    internet_message_id: "<abc@example.com>",
    from_name: "Alice",
    from_address: "alice@example.com",
    to_addresses: ["bob@example.com"],
    subject: "Hi",
    snippet: "Hello",
    email_date: 1000,
    received_at: 1001,
    is_read: false,
    is_starred: true,
    folder_id: "inbox",
    folder_entered_at: 1001,
    raw_object_key: "raw/m1.eml",
    sync_version: 7,
    updated_at: 1002,
    ...overrides,
  };
}

describe("toLocalMessage", () => {
  it("keeps local fields incl. to_addresses and folder_entered_at", () => {
    expect(toLocalMessage(detail())).toEqual({
      id: "m1",
      from_name: "Alice",
      from_address: "alice@example.com",
      to_addresses: ["bob@example.com"],
      subject: "Hi",
      snippet: "Hello",
      email_date: 1000,
      received_at: 1001,
      is_read: false,
      is_starred: true,
      folder_id: "inbox",
      folder_entered_at: 1001,
      sync_version: 7,
      updated_at: 1002,
    });
  });

  it("drops server-only fields", () => {
    const local = toLocalMessage(detail());
    expect(local).not.toHaveProperty("mailbox_id");
    expect(local).not.toHaveProperty("internet_message_id");
    expect(local).not.toHaveProperty("raw_object_key");
  });

  it("copies to_addresses instead of aliasing", () => {
    const input = detail();
    const local = toLocalMessage(input);
    expect(local.to_addresses).toEqual(input.to_addresses);
    expect(local.to_addresses).not.toBe(input.to_addresses);
  });

  it("preserves null folder_entered_at and null from_name", () => {
    const local = toLocalMessage(detail({ folder_entered_at: null, from_name: null }));
    expect(local.folder_entered_at).toBeNull();
    expect(local.from_name).toBeNull();
  });
});
