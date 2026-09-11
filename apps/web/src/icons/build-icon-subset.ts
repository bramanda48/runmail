// Generator for ./lucide-subset.json — the minimal offline Iconify collection
// registered in ./index.ts.
//
// The full `@iconify-json/lucide` collection (~1900 icons) is only used here
// as a build-time source; it is never bundled. To use a new icon, add its
// name to USED_ICONS below and re-run:
//
//   bun run build:icons
//
// The script also scans `src/` for icon usages and fails if any used icon is
// missing from USED_ICONS, so a missing icon fails loudly here instead of
// rendering nothing at runtime.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fullCollection from "@iconify-json/lucide/icons.json";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..");
const outFile = join(here, "lucide-subset.json");

// Exact set of icon names referenced in `src/` (templates and code).
// Keep sorted; run `bun run build:icons` after editing.
const USED_ICONS = [
  "alert-triangle",
  "archive",
  "arrow-left",
  "check",
  "check-circle",
  "check-circle-2",
  "chevron-down",
  "chevron-left",
  "chevron-right",
  "chevron-up",
  "chevrons-right",
  "circle-alert",
  "cloud-off",
  "eye",
  "eye-off",
  "filter",
  "folder",
  "folder-input",
  "folder-open",
  "folder-plus",
  "globe",
  "image-off",
  "inbox",
  "info",
  "loader-circle",
  "lock",
  "log-out",
  "mail",
  "mail-open",
  "menu",
  "paperclip",
  "pencil",
  "plus",
  "refresh-cw",
  "search",
  "shield-alert",
  "star",
  "trash",
  "trash-2",
  "users",
  "x"
];

interface IconifyCollection {
  prefix: string;
  width?: number;
  height?: number;
  icons: Record<string, Record<string, unknown>>;
  aliases?: Record<string, Record<string, unknown>>;
}

function collectUsedNames(dir: string, found: Set<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectUsedNames(path, found);
    } else if (entry.isFile() && /\.(vue|ts)$/.test(entry.name)) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(/lucide:([a-z0-9-]+)/g)) {
        found.add(match[1]);
      }
    }
  }
}

const collection = fullCollection as unknown as IconifyCollection;

const subset: IconifyCollection = { prefix: collection.prefix, icons: {} };
if (collection.width !== undefined) {
  subset.width = collection.width;
}
if (collection.height !== undefined) {
  subset.height = collection.height;
}

const unknown: string[] = [];
for (const name of USED_ICONS) {
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
  console.error(`Unknown lucide icons: ${unknown.join(", ")}`);
  process.exit(1);
}

// Safety net: every name referenced in src/ must be covered by USED_ICONS.
const referenced = new Set<string>();
collectUsedNames(srcDir, referenced);
const uncovered = [...referenced].filter((name) => !USED_ICONS.includes(name));
if (uncovered.length > 0) {
  console.error(`Icons used in src/ but missing from USED_ICONS: ${uncovered.sort().join(", ")}`);
  process.exit(1);
}

const checkOnly = process.argv.includes("--check");
if (checkOnly) {
  console.log(
    `Icon check passed: ${Object.keys(subset.icons).length} icons cover all src/ usages.`
  );
  process.exit(0);
}

writeFileSync(outFile, `${JSON.stringify(subset, null, 2)}\n`);
const aliasCount = subset.aliases ? Object.keys(subset.aliases).length : 0;
console.log(`Wrote ${outFile}: ${Object.keys(subset.icons).length} icons, ${aliasCount} aliases`);
