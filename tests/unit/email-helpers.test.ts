import { describe, expect, it } from "bun:test";
import {
  buildRecipientRows,
  findHeader,
  MAX_EMAIL_BYTES,
  MAX_RECIPIENT_ROWS,
  normalizeSnippet,
  parseEmailAddress,
  resolveEmailDate,
  serializeHeaders
} from "../../apps/worker/src/modules/email/helpers";

describe("MAX_EMAIL_BYTES", () => {
  it("is 25 MB", () => {
    expect(MAX_EMAIL_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe("parseEmailAddress", () => {
  it("parses a valid address", () => {
    expect(parseEmailAddress("user@example.com")).toEqual({
      local_part: "user",
      domain: "example.com"
    });
  });

  it("splits at the last @", () => {
    expect(parseEmailAddress("weird@local@example.com")).toEqual({
      local_part: "weird@local",
      domain: "example.com"
    });
  });

  it("lowercases both parts", () => {
    expect(parseEmailAddress("User@Example.COM")).toEqual({
      local_part: "user",
      domain: "example.com"
    });
  });

  it("returns null when @ is missing", () => {
    expect(parseEmailAddress("not-an-address")).toBe(null);
  });

  it("returns null when either side is empty", () => {
    expect(parseEmailAddress("@example.com")).toBe(null);
    expect(parseEmailAddress("user@")).toBe(null);
    expect(parseEmailAddress("@")).toBe(null);
  });
});

describe("serializeHeaders", () => {
  it("joins key: value lines with newline", () => {
    expect(
      serializeHeaders([
        { key: "from", value: "a@b.c" },
        { key: "x-mailer", value: "Outlook" }
      ])
    ).toBe("from: a@b.c\nx-mailer: Outlook");
  });

  it("returns empty string for no headers", () => {
    expect(serializeHeaders([])).toBe("");
  });
});

describe("normalizeSnippet", () => {
  it("collapses whitespace runs and trims", () => {
    expect(normalizeSnippet("  hello\t\n  world  ")).toBe("hello world");
  });

  it("cuts at 200 chars by default", () => {
    const long = `a${" ".repeat(50)}b${"x".repeat(300)}`;
    const out = normalizeSnippet(long);
    expect(out.length).toBe(200);
    expect(out).toBe(`a b${"x".repeat(197)}`);
  });

  it("respects a custom max", () => {
    expect(normalizeSnippet("hello world", 5)).toBe("hello");
  });

  it("returns empty string for null or empty", () => {
    expect(normalizeSnippet(null)).toBe("");
    expect(normalizeSnippet("")).toBe("");
  });
});

describe("resolveEmailDate", () => {
  it("parses a valid date header", () => {
    expect(resolveEmailDate("Wed, 10 Sep 2026 12:00:00 +0000", 123)).toBe(
      Date.parse("Wed, 10 Sep 2026 12:00:00 +0000")
    );
  });

  it("falls back to receivedAt for invalid headers", () => {
    expect(resolveEmailDate("not a date", 456)).toBe(456);
  });

  it("falls back to receivedAt when missing", () => {
    expect(resolveEmailDate(null, 789)).toBe(789);
    expect(resolveEmailDate(undefined, 789)).toBe(789);
  });
});

describe("findHeader", () => {
  const headers = [
    { key: "subject", value: "Hi" },
    { key: "message-id", value: "<a@b>" }
  ];

  it("matches keys case-insensitively", () => {
    expect(findHeader(headers, "Message-ID")).toBe("<a@b>");
    expect(findHeader(headers, "SUBJECT")).toBe("Hi");
  });

  it("returns the first occurrence", () => {
    const dupes = [
      { key: "x-tag", value: "first" },
      { key: "X-Tag", value: "second" }
    ];
    expect(findHeader(dupes, "x-tag")).toBe("first");
  });

  it("returns null when absent", () => {
    expect(findHeader(headers, "date")).toBe(null);
  });
});

describe("buildRecipientRows", () => {
  it("filters empty addresses", () => {
    expect(
      buildRecipientRows(
        [{ address: "a@x.c", name: "A" }, { address: "" }],
        [{ name: "NoAddr" }],
        []
      )
    ).toEqual([{ recipient_type: "to", address: "a@x.c", name: "A" }]);
  });

  it("orders to→cc→bcc", () => {
    expect(
      buildRecipientRows(
        [{ address: "t@x.c" }],
        [{ address: "c@x.c" }],
        [{ address: "b@x.c" }]
      ).map((r) => r.recipient_type)
    ).toEqual(["to", "cc", "bcc"]);
  });

  it("caps at 90 with to rows preserved when cc/bcc overflow", () => {
    expect(MAX_RECIPIENT_ROWS).toBe(90);
    const to = Array.from({ length: 10 }, (_, i) => ({
      address: `t${i}@x.c`
    }));
    const cc = Array.from({ length: 100 }, (_, i) => ({
      address: `c${i}@x.c`
    }));
    const rows = buildRecipientRows(to, cc, []);
    expect(rows).toHaveLength(90);
    expect(rows.filter((r) => r.recipient_type === "to")).toHaveLength(10);
    expect(
      rows.every((r, i) => (i < 10 ? r.recipient_type === "to" : r.recipient_type === "cc"))
    ).toBe(true);
  });

  it("empty inputs → []", () => {
    expect(buildRecipientRows([], [], [])).toEqual([]);
  });
});
