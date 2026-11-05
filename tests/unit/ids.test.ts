import { describe, expect, it } from "bun:test";
import { createId } from "../../apps/worker/src/lib/ids";

const CUID2_RE = /^[a-z0-9]{32}$/;

describe("createId", () => {
  it("returns a 32-char string", () => {
    const id = createId();
    expect(typeof id).toBe("string");
    expect(id).toHaveLength(32);
  });

  it("matches lowercase alphanumeric charset", () => {
    for (let i = 0; i < 10; i++) {
      expect(createId()).toMatch(CUID2_RE);
    }
  });

  it("produces 1000 unique values", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(createId());
    }
    expect(seen.size).toBe(1000);
  });
});
