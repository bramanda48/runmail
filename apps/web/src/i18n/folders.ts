import { i18n } from "./index";

export interface FolderNameSource {
  name: string;
  folder_type: "system" | "custom";
}

export function folderDisplayName(folder: FolderNameSource): string {
  return folder.folder_type === "system" ? i18n.global.t(folder.name) : folder.name;
}
