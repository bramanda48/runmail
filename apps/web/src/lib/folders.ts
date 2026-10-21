import type { LocalFolder } from "@/db/mailbox-db";
import { SYSTEM_FOLDER_KEYS } from "@runmail/shared";

const SYSTEM_ORDER: readonly string[] = SYSTEM_FOLDER_KEYS;

function systemKey(folder: LocalFolder): string {
  return folder.name.trim().toLowerCase();
}

/** Sidebar order: system folders in fixed order, then custom folders alphabetically. */
export function sortFolders(folders: LocalFolder[]): LocalFolder[] {
  const system = folders
    .filter((f) => f.folder_type === "system")
    .sort((a, b) => {
      const ai = SYSTEM_ORDER.indexOf(systemKey(a));
      const bi = SYSTEM_ORDER.indexOf(systemKey(b));
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  const custom = folders
    .filter((f) => f.folder_type === "custom")
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...system, ...custom];
}

/** Iconify name for a folder: system folders by their system key, custom folders generic. */
export function folderIcon(folder: LocalFolder): string {
  if (folder.folder_type !== "system") return "lucide:folder";
  switch (systemKey(folder)) {
    case "system.inbox":
      return "lucide:inbox";
    case "system.draft":
      return "lucide:file";
    case "system.sent":
      return "lucide:send-horizontal";
    case "system.archive":
      return "lucide:archive";
    case "system.spam":
      return "lucide:shield-alert";
    case "system.trash":
      return "lucide:trash";
    default:
      return "lucide:folder";
  }
}
