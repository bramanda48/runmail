import { getDb } from "@/lib/db";
import type { AppContext } from "@/lib/env";
import type { Setting } from "@runmail/db";
import { SETTINGS_SINGLETON_ID, settings } from "@runmail/db";
import { eq } from "drizzle-orm";

export const PUBLIC_SETTING_KEYS = [
  "brand_name",
  "is_setup_complete",
] as const satisfies readonly (keyof Setting)[];

export type PublicSettingKey = (typeof PUBLIC_SETTING_KEYS)[number];
export type PublicSettings = Pick<Setting, PublicSettingKey>;

function toPublicSettings(row: Setting | null): PublicSettings | null {
  if (!row) return null;
  return { brand_name: row.brand_name, is_setup_complete: row.is_setup_complete };
}

export async function getPublicSettings(c: AppContext): Promise<PublicSettings | null> {
  return toPublicSettings(await ensureSettings(c));
}

export async function getPublicSettingValue<K extends PublicSettingKey>(
  c: AppContext,
  key: K,
): Promise<PublicSettings[K] | null> {
  const projected = await getPublicSettings(c);
  if (!projected) return null;
  return projected[key];
}

export async function getSettings(c: AppContext): Promise<Setting | null> {
  const db = getDb(c);
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_SINGLETON_ID))
    .limit(1);
  return row ?? null;
}

export async function ensureSettings(c: AppContext): Promise<Setting> {
  const db = getDb(c);
  const [row] = await db
    .insert(settings)
    .values({ id: SETTINGS_SINGLETON_ID, updated_at: Date.now() })
    .onConflictDoNothing({ target: settings.id })
    .returning();
  if (row) return row;
  const existing = await getSettings(c);
  if (!existing) throw new Error("Settings is missing");
  return existing;
}

export async function updateSettings(c: AppContext, patch: Partial<Setting>): Promise<Setting> {
  await ensureSettings(c);
  const db = getDb(c);
  const [row] = await db
    .update(settings)
    .set({ ...patch, updated_at: Date.now() })
    .where(eq(settings.id, SETTINGS_SINGLETON_ID))
    .returning();

  if (!row) throw new Error("Settings is missing");
  return row;
}

export async function clearCloudflareToken(c: AppContext): Promise<void> {
  await updateSettings(c, { cloudflare_oauth_token: null });
}
