import * as schema from "@runmail/db";
import { drizzle } from "drizzle-orm/d1";

export interface Bindings {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_ENV: string;
  JWT_SIGNING_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
  CLOUDFLARE_OAUTH_CLIENT_ID: string;
  CLOUDFLARE_OAUTH_CLIENT_SECRET: string;
  RAW_EMAIL_BUCKET: R2Bucket;
  TRASH_SPAM_RETENTION_DAYS: string;
  SYNC_RETENTION_DAYS: string;
}

export function getDb(c: { env: { DB: D1Database } }) {
  return drizzle(c.env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
