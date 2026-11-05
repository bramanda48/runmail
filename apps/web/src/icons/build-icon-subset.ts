// Generator for ./subset/<prefix>.json - the minimal offline Iconify collections
// registered in ./index.ts.
//
// The full `@iconify-json/*` collections are only used here as build-time
// sources; they are never bundled. To use a new icon, add its name under the
// right prefix in USED_ICONS below and re-run:
//
//   bun run build:icons
//
// The script also scans `src/` for icon usages and fails if any used icon is
// missing from USED_ICONS, so a missing icon fails loudly here instead of
// rendering nothing at runtime.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..");
const outDir = join(here, "subset");

// Exact set of icons referenced in `src/` (templates and code), keyed by
// collection prefix. Keep each list sorted; run `bun run build:icons`
// after editing.
const USED_ICONS: Record<string, string[]> = {
  lucide: [
    "alert-triangle",
    "archive",
    "arrow-left",
    "calendar-check",
    "check",
    "check-circle",
    "check-circle-2",
    "chevron-down",
    "chevron-left",
    "chevron-right",
    "chevron-up",
    "chevrons-right",
    "circle-alert",
    "circle-check",
    "circle-help",
    "circle-user-round",
    "circle-x",
    "clock",
    "cloud-off",
    "ellipsis-vertical",
    "eye",
    "eye-off",
    "file",
    "file-text",
    "filter",
    "folder",
    "folder-input",
    "folder-open",
    "folder-plus",
    "forward",
    "globe",
    "image-off",
    "inbox",
    "info",
    "languages",
    "layout-grid",
    "lightbulb",
    "link",
    "loader-circle",
    "lock",
    "log-out",
    "mail",
    "mail-open",
    "maximize-2",
    "menu",
    "minus",
    "monitor",
    "moon",
    "octagon-alert",
    "paperclip",
    "pencil",
    "plus",
    "refresh-cw",
    "route",
    "route-off",
    "reply",
    "search",
    "send",
    "send-horizontal",
    "settings",
    "shield",
    "shield-alert",
    "sliders-horizontal",
    "smile",
    "square",
    "square-check",
    "square-minus",
    "star",
    "sun",
    "trash",
    "trash-2",
    "type",
    "user",
    "users",
    "x",
  ],
};

interface IconifyCollection {
  prefix: string;
  width?: number;
  height?: number;
  icons: Record<string, Record<string, unknown>>;
  aliases?: Record<string, { parent: string } & Record<string, unknown>>;
}

function collectUsedNames(dir: string, found: Map<string, Set<string>>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "icons") continue;
      collectUsedNames(path, found);
    } else if (entry.isFile() && /\.(vue|ts)$/.test(entry.name)) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(/([a-z0-9-]+):([a-z0-9-]+)/g)) {
        const [, prefix, name] = match;
        if (prefix in USED_ICONS) {
          if (!found.has(prefix)) found.set(prefix, new Set());
          found.get(prefix)?.add(name);
        }
      }
    }
  }
}

function buildSubset(prefix: string, names: string[]): { icons: number; aliases: number } {
  const sourcePath = join(
    here,
    "..",
    "..",
    "node_modules",
    `@iconify-json/${prefix}`,
    "icons.json",
  );
  const collection = JSON.parse(readFileSync(sourcePath, "utf8")) as IconifyCollection;

  const subset: IconifyCollection = { prefix: collection.prefix, icons: {} };
  if (collection.width !== undefined) {
    subset.width = collection.width;
  }
  if (collection.height !== undefined) {
    subset.height = collection.height;
  }

  const unknown: string[] = [];
  for (const name of names) {
    if (collection.icons[name] !== undefined) {
      subset.icons[name] = collection.icons[name];
    } else if (collection.aliases?.[name] !== undefined) {
      const alias = collection.aliases[name];
      const parent = alias.parent;
      if (typeof parent === "string" && collection.icons[parent] !== undefined) {
        subset.icons[parent] = collection.icons[parent];
        const aliases = subset.aliases ?? {};
        aliases[name] = alias;
        subset.aliases = aliases;
      } else {
        unknown.push(name);
      }
    } else {
      unknown.push(name);
    }
  }

  if (unknown.length > 0) {
    console.error(`Unknown ${prefix} icons: ${unknown.join(", ")}`);
    process.exit(1);
  }

  writeFileSync(join(outDir, `${prefix}.json`), `${JSON.stringify(subset, null, 2)}\n`);
  const aliasCount = subset.aliases ? Object.keys(subset.aliases).length : 0;
  console.log(
    `Wrote subset/${prefix}.json: ${Object.keys(subset.icons).length} icons, ${aliasCount} aliases`,
  );
  return { icons: Object.keys(subset.icons).length, aliases: aliasCount };
}

// Safety net: every name referenced in src/ must be covered by USED_ICONS.
const referenced = new Map<string, Set<string>>();
collectUsedNames(srcDir, referenced);
const uncovered: string[] = [];
for (const [prefix, names] of referenced) {
  const declared = USED_ICONS[prefix] ?? [];
  for (const name of names) {
    if (!declared.includes(name)) uncovered.push(`${prefix}:${name}`);
  }
}
if (uncovered.length > 0) {
  console.error(`Icons used in src/ but missing from USED_ICONS: ${uncovered.sort().join(", ")}`);
  process.exit(1);
}

const checkOnly = process.argv.includes("--check");
if (checkOnly) {
  console.log(`Icon check passed: ${Object.keys(USED_ICONS).join(", ")} cover all src/ usages.`);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
for (const [prefix, names] of Object.entries(USED_ICONS)) {
  buildSubset(prefix, names);
}
