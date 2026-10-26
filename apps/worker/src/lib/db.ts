import * as schema from "@runmail/db";
import { drizzle } from "drizzle-orm/d1";

export function getDb(c: { env: { DB: D1Database } }) {
  return drizzle(c.env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
