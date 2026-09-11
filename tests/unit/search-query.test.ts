import { describe, expect, it } from "bun:test";
import { parseSearchQuery } from "../../apps/web/src/lib/search";

describe("parseSearchQuery", () => {
  it("puts bare tokens into general", () => {
    expect(parseSearchQuery("invoice acme")).toEqual({
      general: ["invoice", "acme"],
      from: [],
      to: [],
      subject: []
    });
  });

  it("routes from:/to:/subject: tokens to their buckets", () => {
    expect(parseSearchQuery("from:alice to:bob subject:hello")).toEqual({
      general: [],
      from: ["alice"],
      to: ["bob"],
      subject: ["hello"]
    });
  });

  it("handles mixed general + prefix tokens", () => {
    expect(parseSearchQuery("invoice from:alice overdue")).toEqual({
      general: ["invoice", "overdue"],
      from: ["alice"],
      to: [],
      subject: []
    });
  });

  it("matches prefixes case-insensitively but keeps values as-is", () => {
    expect(parseSearchQuery("FROM:Alice Subject:Hello")).toEqual({
      general: [],
      from: ["Alice"],
      to: [],
      subject: ["Hello"]
    });
  });

  it("returns empty buckets for an empty query", () => {
    expect(parseSearchQuery("")).toEqual({ general: [], from: [], to: [], subject: [] });
    expect(parseSearchQuery("   ")).toEqual({ general: [], from: [], to: [], subject: [] });
  });

  it("treats unknown prefixes and bare colons as general tokens", () => {
    expect(parseSearchQuery("cc:bob foo: bar:")).toEqual({
      general: ["cc:bob", "foo:", "bar:"],
      from: [],
      to: [],
      subject: []
    });
  });

  it("collapses extra whitespace", () => {
    expect(parseSearchQuery("  a   b  ")).toEqual({
      general: ["a", "b"],
      from: [],
      to: [],
      subject: []
    });
  });
});
