import type { LocalFolder } from "@/db/mailbox-db";

const SYSTEM_ORDER = ["inbox", "draft", "sent", "archive", "spam", "trash"];

/** Sidebar order: system folders in fixed order, then custom folders alphabetically. */
export function sortFolders(folders: LocalFolder[]): LocalFolder[] {
  const system = folders
    .filter((f) => f.folder_type === "system")
    .sort((a, b) => {
      const ai = SYSTEM_ORDER.indexOf(a.name.toLowerCase());
      const bi = SYSTEM_ORDER.indexOf(b.name.toLowerCase());
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

/** Iconify name for a folder: system folders by name, custom folders generic. */
export function folderIcon(folder: LocalFolder): string {
  if (folder.folder_type !== "system") return "lucide:folder";
  switch (folder.name.toLowerCase()) {
    case "inbox":
      return "lucide:inbox";
    case "draft":
      return "lucide:file";
    case "sent":
      return "lucide:send-horizontal";
    case "archive":
      return "lucide:archive";
    case "spam":
      return "lucide:shield-alert";
    case "trash":
      return "lucide:trash";
    default:
      return "lucide:folder";
  }
}
