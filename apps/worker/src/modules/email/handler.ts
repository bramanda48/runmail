import type { ForwardableEmailMessage as EmailMessage } from "@cloudflare/workers-types";
import {
  domains,
  folders,
  mailboxes,
  messageRecipients,
  messages,
  rulesetActions,
  rulesetConditions,
  rulesets
} from "@runmail/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import PostalMime from "postal-mime";
import { bumpCounterStmt, emitEventStmt, nextVersionSql } from "../../lib/allocate";
import type { Bindings } from "../../lib/db";
import { getDb } from "../../lib/db";
import { uuidv7 } from "../../lib/ids";
import { createExecutionLogger } from "../../lib/logger";
import { deleteRawEmail, putRawEmail, rawObjectKey } from "../../lib/r2";
import type { EvaluableRuleset } from "../../lib/rules-engine";
import { evaluateRulesets } from "../../lib/rules-engine";
import {
  buildRecipientRows,
  findHeader,
  MAX_EMAIL_BYTES,
  normalizeSnippet,
  parseEmailAddress,
  resolveEmailDate,
  serializeHeaders
} from "./helpers";

export async function handleInboundEmail(
  message: EmailMessage,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  const execution_id = crypto.randomUUID();
  const logger = createExecutionLogger(execution_id, { event: "email_inbound" });

  if (message.rawSize > MAX_EMAIL_BYTES) {
    await message.setReject("Message exceeds 25 MB limit");
    return;
  }

  // Buffered read is intentional: size validation requires the full payload,
  // PostalMime.parse needs a complete buffer, and the R2 upload takes an ArrayBuffer.
  const rawBuf = new Uint8Array(await new Response(message.raw).arrayBuffer());
  if (rawBuf.byteLength > MAX_EMAIL_BYTES) {
    await message.setReject("Message exceeds 25 MB limit");
    return;
  }

  const parsed = await PostalMime.parse(rawBuf, {
    maxNestingDepth: 50,
    maxHeadersSize: 512 * 1024
  });

  const recipient = parseEmailAddress(message.to);
  if (recipient === null) {
    await message.setReject("Invalid recipient address");
    return;
  }

  const db = getDb({ env });

  const [mailboxRow] = await db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domain_id, domains.id))
    .where(
      and(
        eq(domains.domain_name, recipient.domain),
        eq(mailboxes.local_part, recipient.local_part),
        eq(domains.verification_status, "active"),
        eq(mailboxes.is_active, true)
      )
    )
    .limit(1);
  if (!mailboxRow) {
    await message.setReject("Mailbox not found or inactive");
    return;
  }
  const mailboxId = mailboxRow.id;

  const rulesetRows = await db
    .select({
      id: rulesets.id,
      priority: rulesets.priority,
      logic_operator: rulesets.logic_operator
    })
    .from(rulesets)
    .where(and(eq(rulesets.mailbox_id, mailboxId), eq(rulesets.is_enabled, true)))
    .orderBy(asc(rulesets.priority), asc(rulesets.id));

  const evaluable: EvaluableRuleset[] = [];
  if (rulesetRows.length > 0) {
    const ids = rulesetRows.map((r) => r.id);
    const [conditionRows, actionRows] = await Promise.all([
      db
        .select({
          ruleset_id: rulesetConditions.ruleset_id,
          field: rulesetConditions.field,
          match_type: rulesetConditions.match_type,
          condition_value: rulesetConditions.condition_value
        })
        .from(rulesetConditions)
        .where(inArray(rulesetConditions.ruleset_id, ids))
        .orderBy(asc(rulesetConditions.condition_order)),
      db
        .select({
          ruleset_id: rulesetActions.ruleset_id,
          action_type: rulesetActions.action_type,
          action_value: rulesetActions.action_value
        })
        .from(rulesetActions)
        .where(inArray(rulesetActions.ruleset_id, ids))
        .orderBy(asc(rulesetActions.action_order))
    ]);
    for (const row of rulesetRows) {
      evaluable.push({
        id: row.id,
        priority: row.priority,
        logic_operator: row.logic_operator,
        conditions: conditionRows
          .filter((c) => c.ruleset_id === row.id)
          .map((c) => ({
            field: c.field,
            match_type: c.match_type,
            condition_value: c.condition_value
          })),
        actions: actionRows
          .filter((a) => a.ruleset_id === row.id)
          .map((a) => ({
            action_type: a.action_type,
            action_value: a.action_value
          }))
      });
    }
  }

  const headers = parsed.headers ?? [];
  const fromDisplay = parsed.from
    ? parsed.from.name
      ? `${parsed.from.name} <${parsed.from.address}>`
      : (parsed.from.address ?? "")
    : "";
  const decision = evaluateRulesets(evaluable, {
    from: fromDisplay,
    subject: parsed.subject ?? "",
    rawHeaders: serializeHeaders(headers)
  });
  let finalFolder: { id: string; folder_type: string; name: string } | null = null;
  if (decision.folder_id !== null) {
    const [target] = await db
      .select({
        id: folders.id,
        folder_type: folders.folder_type,
        name: folders.name
      })
      .from(folders)
      .where(and(eq(folders.id, decision.folder_id), eq(folders.mailbox_id, mailboxId)))
      .limit(1);
    if (target) finalFolder = target;
  }
  if (finalFolder === null) {
    const [inbox] = await db
      .select({
        id: folders.id,
        folder_type: folders.folder_type,
        name: folders.name
      })
      .from(folders)
      .where(
        and(
          eq(folders.mailbox_id, mailboxId),
          eq(folders.folder_type, "system"),
          eq(folders.name, "inbox")
        )
      )
      .limit(1);
    finalFolder = inbox ?? null;
  }
  if (!finalFolder) {
    logger.error("ingest_inbox_folder_missing", undefined, {
      mailbox_id: mailboxId
    });
    await message.setReject("Internal mailbox error, please try again later");
    return;
  }

  const now = Date.now();
  const folderName = finalFolder.name.toLowerCase();
  const folderEnteredAt =
    finalFolder.folder_type === "system" && (folderName === "trash" || folderName === "spam")
      ? now
      : null;

  const messageId = uuidv7();
  const internetMessageId = findHeader(headers, "message-id");
  const fromName = parsed.from?.name ?? null;
  const fromAddress = parsed.from?.address ?? "";
  const subject = parsed.subject ?? "";
  const snippet = normalizeSnippet(parsed.text ?? null);
  const receivedAt = Date.now();
  const emailDate = resolveEmailDate(findHeader(headers, "date"), receivedAt);
  const rawKey = rawObjectKey(mailboxId, messageId);

  const rawBody: ArrayBuffer = rawBuf.buffer.slice(
    rawBuf.byteOffset,
    rawBuf.byteOffset + rawBuf.byteLength
  );
  try {
    await putRawEmail(env, rawKey, rawBody);
  } catch {
    await message.setReject("Storage failure, please retry sending");
    return;
  }

  const recipientRows = buildRecipientRows(parsed.to ?? [], parsed.cc ?? [], parsed.bcc ?? []);
  const toAddresses = recipientRows.filter((r) => r.recipient_type === "to").map((r) => r.address);

  const versionSql = nextVersionSql(mailboxId);
  const snapshotJson = JSON.stringify({
    id: messageId,
    mailbox_id: mailboxId,
    internet_message_id: internetMessageId,
    from_name: fromName,
    from_address: fromAddress,
    subject,
    snippet,
    email_date: emailDate,
    received_at: receivedAt,
    is_read: decision.is_read,
    is_starred: decision.is_starred,
    folder_id: finalFolder.id,
    folder_entered_at: folderEnteredAt,
    raw_object_key: rawKey,
    sync_version: 0,
    updated_at: now,
    to_addresses: toAddresses
  });
  const payload = sql`json_object('message_id', ${messageId}, 'sync_version', ${versionSql}, 'message', json_set(json(${snapshotJson}), '$.sync_version', ${versionSql}))`;

  try {
    await db.batch([
      bumpCounterStmt(db, mailboxId),
      db.insert(messages).values({
        id: messageId,
        mailbox_id: mailboxId,
        internet_message_id: internetMessageId,
        from_name: fromName,
        from_address: fromAddress,
        subject,
        snippet,
        email_date: emailDate,
        received_at: receivedAt,
        is_read: decision.is_read,
        is_starred: decision.is_starred,
        folder_id: finalFolder.id,
        folder_entered_at: folderEnteredAt,
        raw_object_key: rawKey,
        sync_version: versionSql as unknown as number,
        updated_at: now
      }),
      ...recipientRows.map((row) =>
        db.insert(messageRecipients).values({
          id: uuidv7(),
          message_id: messageId,
          recipient_type: row.recipient_type,
          display_name: row.name,
          email_address: row.address
        })
      ),
      emitEventStmt(db, {
        mailbox_id: mailboxId,
        event_type: "message_created",
        message_id: messageId,
        payload,
        sync_version_sql: versionSql,
        created_at: now
      })
    ] as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    await deleteRawEmail(env, rawKey);
    await message.setReject("Storage failure, please resend this message");
    return;
  }

  logger.info("email_ingested", {
    mailbox_id: mailboxId,
    message_id: messageId,
    folder_id: finalFolder.id
  });
}
