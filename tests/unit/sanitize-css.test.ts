import { describe, expect, it } from "bun:test";
import { isRemoteUri, scrubRemoteCssUrls, srcsetHasRemote } from "../../apps/web/src/lib/sanitize";

describe("scrubRemoteCssUrls", () => {
  it("scrubs https url() in style attributes", () => {
    expect(scrubRemoteCssUrls("background: url(https://evil.test/x.png)")).toBe(
      "background: url()"
    );
  });

  it("scrubs quoted http and protocol-relative urls", () => {
    expect(scrubRemoteCssUrls("background:url('http://evil.test/x.png')")).toBe("background:url()");
    expect(scrubRemoteCssUrls('background: url("//evil.test/x.png")')).toBe("background: url()");
  });

  it("scrubs case-insensitively", () => {
    expect(scrubRemoteCssUrls("BACKGROUND: URL(HTTPS://EVIL.TEST/A.PNG)")).toBe(
      "BACKGROUND: url()"
    );
  });

  it("scrubs multiple urls but keeps data: and cid: alone", () => {
    expect(
      scrubRemoteCssUrls(
        "background: url(https://evil.test/a.png), url(data:image/png;base64,AAA); list-style: url(cid:img1)"
      )
    ).toBe("background: url(), url(data:image/png;base64,AAA); list-style: url(cid:img1)");
  });

  it("keeps relative urls alone", () => {
    expect(scrubRemoteCssUrls("background: url(/assets/x.png)")).toBe(
      "background: url(/assets/x.png)"
    );
  });

  it("leaves css without urls untouched", () => {
    expect(scrubRemoteCssUrls("color: red; font-weight: bold")).toBe(
      "color: red; font-weight: bold"
    );
  });
});

describe("isRemoteUri", () => {
  it("flags http/https and protocol-relative urls", () => {
    expect(isRemoteUri("https://evil.test/x.png")).toBe(true);
    expect(isRemoteUri("http://evil.test/x.png")).toBe(true);
    expect(isRemoteUri("//evil.test/x.png")).toBe(true);
    expect(isRemoteUri("HTTPS://EVIL.TEST/X.PNG")).toBe(true);
    expect(isRemoteUri("  https://evil.test/x.png  ")).toBe(true);
  });

  it("lets data:, cid: and relative urls through", () => {
    expect(isRemoteUri("data:image/png;base64,AAA")).toBe(false);
    expect(isRemoteUri("cid:img1")).toBe(false);
    expect(isRemoteUri("/assets/x.png")).toBe(false);
    expect(isRemoteUri("assets/x.png")).toBe(false);
    expect(isRemoteUri("")).toBe(false);
  });
});

describe("srcsetHasRemote", () => {
  it("detects a remote candidate anywhere in the list", () => {
    expect(srcsetHasRemote("https://evil.test/a.png 1x")).toBe(true);
    expect(srcsetHasRemote("data:image/png;base64,AAA 1x, https://evil.test/b.png 2x")).toBe(true);
    expect(srcsetHasRemote("//evil.test/a.png 480w, /local/b.png 800w")).toBe(true);
  });

  it("lets all-local srcsets through", () => {
    expect(srcsetHasRemote("data:image/png;base64,AAA 1x")).toBe(false);
    expect(srcsetHasRemote("cid:img1")).toBe(false);
    expect(srcsetHasRemote("/local/a.png 1x, /local/b.png 2x")).toBe(false);
    expect(srcsetHasRemote("")).toBe(false);
  });
});
