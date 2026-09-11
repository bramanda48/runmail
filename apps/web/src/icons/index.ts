import { addCollection } from "@iconify/vue/dist/offline";
import subset from "./lucide-subset.json";

export { Icon } from "@iconify/vue/dist/offline";

// Minimal offline subset of the lucide collection (see ./lucide-subset.json).
// After adding a new `lucide:*` usage, add the icon name to USED_ICONS in
// ./build-icon-subset.ts and re-run `bun run build:icons`.
addCollection(subset);
