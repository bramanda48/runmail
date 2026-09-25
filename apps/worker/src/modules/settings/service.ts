import type { Setting } from "@runmail/db";
import { settings } from "@runmail/db";
import { eq } from "drizzle-orm";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";

export const SETTING_NAMES = {
  CLOUDFLARE_OAUTH_TOKEN: "CLOUDFLARE_OAUTH_TOKEN",
} as const;

export type SettingName = (typeof SETTING_NAMES)[keyof typeof SETTING_NAMES];

export async function getSetting(c: AppContext, name: SettingName): Promise<Setting | null> {
  const db = getDb(c);
  const [row] = await db.select().from(settings).where(eq(settings.name, name)).limit(1);
  return row ?? null;
}

export async function upsertSetting(
  c: AppContext,
  name: SettingName,
  value: string,
): Promise<Setting> {
  const db = getDb(c);
  const now = Date.now();
  const id = uuidv7();

  await db
    .insert(settings)
    .values({
      id,
      name,
      value,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: settings.name,
      set: { value, updated_at: now },
    });

  const [row] = await db.select().from(settings).where(eq(settings.name, name)).limit(1);
  if (!row) throw new Error(`Setting ${name} not found after upsert`);
  return row;
}

export async function deleteSetting(c: AppContext, name: SettingName): Promise<void> {
  const db = getDb(c);
  await db.delete(settings).where(eq(settings.name, name));
}
