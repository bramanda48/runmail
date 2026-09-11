import { describe, expect, it } from "bun:test";
import {
  buildMessageCursor,
  decodeCursor,
  encodeCursor,
  syncMutationItemSchema
} from "../../packages/shared/src/index";

describe("decodeCursor MessageCursorPayload roundtrip", () => {
  it("roundtrips email_date + message_id", () => {
    const payload = { email_date: 1757452800000, message_id: "0193a1b2-uuid7" };
    const decoded = decodeCursor<typeof payload>(encodeCursor(payload));
    expect(decoded).toEqual(payload);
  });

  it("roundtrips buildMessageCursor output", () => {
    const cursor = buildMessageCursor({
      email_date: 1757452800000,
      message_id: "0193a1b2-uuid7"
    });
    expect(decodeCursor<typeof cursor>(encodeCursor({ ...cursor }))).toEqual(cursor);
  });
});

describe("encodeCursor/decodeCursor identity", () => {
  it("decodes what it encodes", () => {
    const payload = { email_date: 1, message_id: "abc" };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it("returns null for a bad version prefix", () => {
    const good = encodeCursor({ email_date: 1, message_id: "abc" });
    expect(decodeCursor(`v9_${good.slice(3)}`)).toBeNull();
    expect(decodeCursor("raw-json-without-prefix")).toBeNull();
  });

  it("returns null for bad base64", () => {
    expect(decodeCursor("v1_!!!not-base64!!!")).toBeNull();
    expect(decodeCursor("v1_")).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    const asRecord = [1, 2, 3] as unknown as Record<string, unknown>;
    expect(decodeCursor(encodeCursor(asRecord))).toBeNull();
  });
});

describe("syncMutationItemSchema discriminated union", () => {
  it("parses a read mutation", () => {
    const parsed = syncMutationItemSchema.safeParse({
      message_id: "msg-1",
      mutation_type: "read",
      mutation_value: true
    });
    expect(parsed.success).toBe(true);
  });

  it("parses a star mutation", () => {
    const parsed = syncMutationItemSchema.safeParse({
      message_id: "msg-1",
      mutation_type: "star",
      mutation_value: false
    });
    expect(parsed.success).toBe(true);
  });

  it("parses a move mutation", () => {
    const parsed = syncMutationItemSchema.safeParse({
      message_id: "msg-1",
      mutation_type: "move",
      mutation_value: "folder-id"
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing discriminator", () => {
    const parsed = syncMutationItemSchema.safeParse({
      message_id: "msg-1",
      mutation_value: true
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown discriminator", () => {
    const parsed = syncMutationItemSchema.safeParse({
      message_id: "msg-1",
      mutation_type: "delete",
      mutation_value: true
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a mistyped value", () => {
    const parsed = syncMutationItemSchema.safeParse({
      message_id: "msg-1",
      mutation_type: "read",
      mutation_value: "folder-id"
    });
    expect(parsed.success).toBe(false);
  });
});
