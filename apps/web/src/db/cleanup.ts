import { clearAllRawCaches } from "@/lib/raw-cache";
import Dexie from "dexie";
import {
  clearKnownMailboxDbNames,
  closeAllMailboxDbs,
  DB_NAME_PREFIX,
  readKnownMailboxDbNames,
} from "./mailbox-db";

/**
 * R6: logout clears the token + ALL per-mailbox Dexie DBs + Cache API raws
 * for the user/session on this device.
 */
export async function wipeLocalData(): Promise<void> {
  closeAllMailboxDbs();
  // indexedDB.databases() is not implemented in every browser (e.g. Firefox
  // private mode or Safari <16.4 at the time of writing) — fall back to the
  // known-DB registry for the Dexie part. Raw caches are still cleared below.
  if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
    const infos = await indexedDB.databases();
    for (const info of infos) {
      if (info.name?.startsWith(DB_NAME_PREFIX)) {
        await Dexie.delete(info.name);
      }
    }
  }
  for (const name of readKnownMailboxDbNames()) {
    try {
      await Dexie.delete(name);
    } catch {
      // Best-effort: one stale registry entry must not fail the wipe.
    }
  }
  clearKnownMailboxDbNames();
  await clearAllRawCaches();
}
