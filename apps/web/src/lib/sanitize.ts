import DOMPurify from "dompurify";

/**
 * Matches remote `url(...)` references inside CSS: `http(s)://` or
 * protocol-relative `//`. `data:`, `cid:` and relative URLs are left alone.
 * Deliberately a simple global replace — no full CSS parsing.
 */
const REMOTE_CSS_URL_RE = /url\(\s*(['"]?)(?:https?:)?\/\/[^)'"]*\1\s*\)/gi;

/**
 * Anchored remote-URI check: `http(s)://` or protocol-relative `//`
 * (case-insensitive). `data:`, `cid:` and relative URLs are NOT remote.
 */
const REMOTE_URI_RE = /^(https?:)?\/\//i;

export function isRemoteUri(value: string): boolean {
  return REMOTE_URI_RE.test(value.trim());
}

/** True when at least one comma-separated srcset candidate is a remote URI. */
export function srcsetHasRemote(value: string): boolean {
  return value
    .split(",")
    .some((candidate) => isRemoteUri(candidate.trim().split(/\s+/, 1)[0] ?? ""));
}

export function scrubRemoteCssUrls(css: string): string {
  REMOTE_CSS_URL_RE.lastIndex = 0;
  return css.replace(REMOTE_CSS_URL_RE, "url()");
}

export interface SanitizeEmailResult {
  html: string;
  /** True when the block path rewrote at least one auto-load attribute. */
  blocked: boolean;
}

export function sanitizeEmailHtml(
  html: string,
  opts: { allowRemoteContent: boolean },
): SanitizeEmailResult {
  const purify = DOMPurify(window);
  if (opts.allowRemoteContent) {
    return { html: purify.sanitize(html, { USE_PROFILES: { html: true } }), blocked: false };
  }

  let blockedCount = 0;

  const blockAttr = (
    node: Element,
    attr: string,
    blockedAttr: string,
    remoteOnly: boolean,
  ): void => {
    const value = node.getAttribute(attr);
    if (!value) return;
    if (remoteOnly && !isRemoteUri(value)) return;
    node.setAttribute(blockedAttr, value);
    node.removeAttribute(attr);
    blockedCount += 1;
  };

  const blockSrcset = (node: Element): void => {
    const value = node.getAttribute("srcset");
    if (!value || !srcsetHasRemote(value)) return;
    node.setAttribute("data-blocked-srcset", value);
    node.removeAttribute("srcset");
    blockedCount += 1;
  };

  purify.addHook("beforeSanitizeAttributes", (node) => {
    switch (node.tagName) {
      case "IMG": {
        // Existing behavior (verbatim): rewrite every src, even data:/cid:.
        const src = node.getAttribute("src");
        if (src) {
          node.setAttribute("data-blocked-src", src);
          node.removeAttribute("src");
          blockedCount += 1;
        }
        blockSrcset(node);
        break;
      }
      case "INPUT": {
        const type = node.getAttribute("type");
        if (type?.toLowerCase() === "image") {
          blockAttr(node, "src", "data-blocked-src", true);
        }
        break;
      }
      case "VIDEO":
        blockAttr(node, "src", "data-blocked-src", true);
        blockAttr(node, "poster", "data-blocked-poster", true);
        break;
      case "AUDIO":
        blockAttr(node, "src", "data-blocked-src", true);
        break;
      case "SOURCE":
        blockAttr(node, "src", "data-blocked-src", true);
        blockSrcset(node);
        break;
      case "TRACK":
        blockAttr(node, "src", "data-blocked-src", true);
        break;
      case "BODY":
      case "TABLE":
      case "TD":
      case "TH":
      case "TR":
        blockAttr(node, "background", "data-blocked-background", true);
        break;
      case "image":
        // SVG <image>: href / xlink:href. <a href> is intentionally untouched.
        blockAttr(node, "href", "data-blocked-href", true);
        blockAttr(node, "xlink:href", "data-blocked-href", true);
        break;
      default:
        break;
    }
  });
  purify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style") {
      data.attrValue = scrubRemoteCssUrls(data.attrValue);
    }
  });
  purify.addHook("afterSanitizeElements", (node) => {
    if ((node as Element).tagName === "STYLE" && node.textContent) {
      node.textContent = scrubRemoteCssUrls(node.textContent);
    }
  });
  try {
    return {
      html: purify.sanitize(html, { USE_PROFILES: { html: true } }),
      blocked: blockedCount > 0,
    };
  } finally {
    purify.removeHook("beforeSanitizeAttributes");
    purify.removeHook("uponSanitizeAttribute");
    purify.removeHook("afterSanitizeElements");
  }
}
