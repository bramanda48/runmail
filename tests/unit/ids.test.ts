import { describe, expect, it } from "bun:test";
import { uuidv7 } from "../../apps/worker/src/lib/ids";

const UUIDV7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("matches the UUIDv7 shape (version nibble 7, RFC 4122 variant)", () => {
    for (let i = 0; i < 10; i++) {
      expect(uuidv7()).toMatch(UUIDV7_RE);
    }
  });

  it("sets version nibble 7 and variant bits 10 explicitly", () => {
    const id = uuidv7().replace(/-/g, "");
    expect(id[12]).toBe("7");
    const variantByte = Number.parseInt(id.slice(16, 18), 16);
    expect(variantByte & 0xc0).toBe(0x80);
  });

  it("is monotonically increasing for consecutive calls with distinct timestamps", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      ids.push(uuidv7());
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect([...ids].sort()).toEqual(ids);
  });

  it("produces 1000 unique values", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(uuidv7());
    }
    expect(seen.size).toBe(1000);
  });
});
