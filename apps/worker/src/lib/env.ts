import type { Context } from "hono";
import type { Bindings } from "./db";

export type AuthUser = { user_id: string; role: string };

export type MailboxAccess = { mailbox_id: string };

export type AppEnv = {
  Bindings: Bindings;
  Variables: { auth: AuthUser; mailbox: MailboxAccess };
};

export type AppContext = Context<AppEnv>;
