import { addCollection } from "@iconify/vue/dist/offline";
import { default as lucide } from "./subset/lucide.json";

export { Icon } from "@iconify/vue/dist/offline";

// Minimal offline subsets, one file per collection (see ./subset/<prefix>.json).
// After adding a new `<prefix>:<name>` usage, add the icon name under the
// right prefix in USED_ICONS in ./build-icon-subset.ts and re-run
// `bun run build:icons`.
addCollection(lucide);
