import type {
  ActionType,
  ApiMeta,
  Domain,
  Folder,
  LogicOperator,
  Mailbox,
  MailboxLinkedUser,
  MatchType,
  Message,
  Role,
  RuleField,
  Ruleset,
  RulesetDetail,
  SyncMutationItem,
  User,
  VerifyDomainResponse
} from "@runmail/shared";

/**
 * Typed fetch client for the Runmail backend (`/api/v1`).
 *
 * Circular-import avoidance: this module NEVER imports the auth store.
 * Instead the auth store registers itself via `setAccessTokenProvider` and
 * `setRefreshHandler`. All auth-state reads go through those injected
 * callbacks, so the dependency direction is strictly store -> api.
 */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type AccessTokenProvider = () => string | null;
type RefreshHandler = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider = () => null;
let refreshHandler: RefreshHandler = async () => null;

export function setAccessTokenProvider(fn: AccessTokenProvider): void {
  accessTokenProvider = fn;
}

export function setRefreshHandler(fn: RefreshHandler): void {
  refreshHandler = fn;
}

export interface RequestOptions {
  body?: unknown;
  auth?: boolean;
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown; details?: unknown };
}

function toApiError(status: number, payload: unknown): ApiError {
  const fallbackMessage = status === 401 ? "Unauthorized" : `Request failed with status ${status}`;
  if (payload !== null && typeof payload === "object" && "error" in payload) {
    const err = (payload as ErrorEnvelope).error;
    const code = typeof err?.code === "string" ? err.code : "INTERNAL_ERROR";
    const message = typeof err?.message === "string" ? err.message : fallbackMessage;
    return new ApiError(code, status, message, err?.details);
  }
  return new ApiError("INTERNAL_ERROR", status, fallbackMessage);
}

const NO_RETRY_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

async function doFetch(method: string, path: string, opts?: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.auth !== false) {
    const token = accessTokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`/api/v1${path}`, {
    method,
    headers,
    body: opts?.body === undefined ? undefined : JSON.stringify(opts.body)
  });
}

async function parseData<T>(res: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (res.ok) {
    if (payload !== null && typeof payload === "object" && "data" in payload) {
      return (payload as { data: T }).data;
    }
    throw new ApiError("INTERNAL_ERROR", res.status, "Malformed success envelope");
  }
  throw toApiError(res.status, payload);
}

async function parseFailure(res: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  return toApiError(res.status, payload);
}

/**
 * Shared fetch → 401 → refresh → retry-once core. Returns the final
 * Response (including a 401 Response when the refresh did not help) so
 * callers can parse the error envelope themselves.
 */
async function performAuthorizedFetch(
  method: string,
  path: string,
  opts?: RequestOptions
): Promise<Response> {
  let res: Response;
  try {
    res = await doFetch(method, path, opts);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("INTERNAL_ERROR", 0, "Network request failed");
  }

  if (
    res.status === 401 &&
    opts?.auth !== false &&
    !NO_RETRY_PATHS.includes(path) &&
    accessTokenProvider() !== null
  ) {
    const refreshed = await refreshHandler();
    if (refreshed === null) {
      throw await parseFailure(res);
    }
    try {
      res = await doFetch(method, path, opts);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("INTERNAL_ERROR", 0, "Network request failed");
    }
    if (res.status === 401) {
      throw await parseFailure(res);
    }
  }

  return res;
}

export async function request<T>(method: string, path: string, opts?: RequestOptions): Promise<T> {
  const res = await performAuthorizedFetch(method, path, opts);
  return parseData<T>(res);
}

export interface RequestWithMeta<T> {
  data: T;
  meta?: ApiMeta;
}

export async function requestWithMeta<T>(
  method: string,
  path: string,
  opts?: RequestOptions
): Promise<RequestWithMeta<T>> {
  const res = await performAuthorizedFetch(method, path, opts);

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (res.ok) {
    if (payload !== null && typeof payload === "object" && "data" in payload) {
      const envelope = payload as { data: T; meta?: ApiMeta };
      return { data: envelope.data, meta: envelope.meta };
    }
    throw new ApiError("INTERNAL_ERROR", res.status, "Malformed success envelope");
  }
  throw toApiError(res.status, payload);
}

/** Builds a `?cursor=&limit=` suffix shared by the cursor-paginated list helpers. */
function pageQuery(cursor?: string, limit?: number): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit !== undefined) params.set("limit", String(limit));
  return params.size > 0 ? `?${params.toString()}` : "";
}

// --- Thin typed helpers used by this phase ---

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
}

export interface AuthPayload {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SessionUser;
}

export async function loginRequest(username: string, password: string): Promise<AuthPayload> {
  return request<AuthPayload>("POST", "/auth/login", {
    body: { username, password },
    auth: false
  });
}

export async function refreshRequest(refreshToken: string): Promise<AuthPayload> {
  return request<AuthPayload>("POST", "/auth/refresh", {
    body: { refresh_token: refreshToken },
    auth: false
  });
}

export async function logoutRequest(refreshToken: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("POST", "/auth/logout", {
    body: { refresh_token: refreshToken }
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("POST", "/auth/change-password", {
    body: {
      current_password: currentPassword,
      new_password: newPassword
    }
  });
}

// --- Users (admin) ---

export interface UserList {
  users: User[];
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: Role;
}

export interface UpdateUserInput {
  role?: Role;
  is_active?: boolean;
  password?: string;
}

export async function listUsers(
  cursor?: string,
  limit?: number
): Promise<RequestWithMeta<UserList>> {
  return requestWithMeta<UserList>("GET", `/users${pageQuery(cursor, limit)}`);
}

export async function createUser(body: CreateUserInput): Promise<{ user: User }> {
  return request<{ user: User }>("POST", "/users", { body });
}

export async function getUser(userId: string): Promise<{ user: User }> {
  return request<{ user: User }>("GET", `/users/${userId}`);
}

export async function updateUser(userId: string, body: UpdateUserInput): Promise<{ user: User }> {
  return request<{ user: User }>("PATCH", `/users/${userId}`, { body });
}

// --- Cloudflare Integration (admin) ---

export function getCloudflareOAuthStatus(): Promise<{ configured: boolean }> {
  return request<{ configured: boolean }>("GET", "/integrations/cloudflare/status");
}

export function authorizeCloudflareOAuth(redirect_uri: string): Promise<{ authorization_url: string; state: string }> {
  return request<{ authorization_url: string; state: string }>("POST", "/integrations/cloudflare/authorize", {
    body: { redirect_uri }
  });
}

export function callbackCloudflareOAuth(code: string, state: string): Promise<{ message: string }> {
  return request<{ message: string }>("POST", "/integrations/cloudflare/callback", {
    body: { code, state }
  });
}

export function completeCloudflareOAuthCallback(
  code: string,
  state: string
): Promise<{ message: string }> {
  return callbackCloudflareOAuth(code, state);
}

export interface AvailableZone {
  id: string;
  name: string;
}

export interface DomainList {
  domains: Domain[];
}

export async function listAvailableDomains(): Promise<{ zones: AvailableZone[] }> {
  return request<{ zones: AvailableZone[] }>("GET", "/domains/available");
}

export async function listDomains(
  cursor?: string,
  limit?: number
): Promise<RequestWithMeta<DomainList>> {
  return requestWithMeta<DomainList>("GET", `/domains${pageQuery(cursor, limit)}`);
}

export async function addDomain(domainName: string): Promise<{ domain: Domain }> {
  return request<{ domain: Domain }>("POST", "/domains", {
    body: { domain_name: domainName }
  });
}

export async function verifyDomain(domainId: string): Promise<VerifyDomainResponse> {
  return request<VerifyDomainResponse>("POST", `/domains/${domainId}/verify`);
}

// --- Mailboxes ---

export interface MailboxList {
  mailboxes: Mailbox[];
}

export interface CreateMailboxInput {
  domain_id: string;
  local_part: string;
}

export interface UpdateMailboxInput {
  local_part?: string;
  is_active?: boolean;
}

export async function listMailboxes(
  cursor?: string,
  limit?: number
): Promise<RequestWithMeta<MailboxList>> {
  return requestWithMeta<MailboxList>("GET", `/mailboxes${pageQuery(cursor, limit)}`);
}

export async function listAllMailboxes(
  cursor?: string,
  limit?: number
): Promise<RequestWithMeta<MailboxList>> {
  return requestWithMeta<MailboxList>("GET", `/mailboxes/all${pageQuery(cursor, limit)}`);
}

export async function createMailbox(body: CreateMailboxInput): Promise<{ mailbox: Mailbox }> {
  return request<{ mailbox: Mailbox }>("POST", "/mailboxes", { body });
}

export async function getMailbox(mailboxId: string): Promise<{ mailbox: Mailbox }> {
  return request<{ mailbox: Mailbox }>("GET", `/mailboxes/${mailboxId}`);
}

export async function updateMailbox(
  mailboxId: string,
  body: UpdateMailboxInput
): Promise<{ mailbox: Mailbox }> {
  return request<{ mailbox: Mailbox }>("PATCH", `/mailboxes/${mailboxId}`, { body });
}

export async function linkMailboxUser(mailboxId: string, userId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("POST", `/mailboxes/${mailboxId}/users`, {
    body: { user_id: userId }
  });
}

export async function unlinkMailboxUser(
  mailboxId: string,
  userId: string
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("DELETE", `/mailboxes/${mailboxId}/users/${userId}`);
}

export interface MailboxLinkedUserList {
  users: MailboxLinkedUser[];
}

export async function getMailboxUsers(
  mailboxId: string,
  cursor?: string,
  limit?: number
): Promise<RequestWithMeta<MailboxLinkedUserList>> {
  return requestWithMeta<MailboxLinkedUserList>(
    "GET",
    `/mailboxes/${mailboxId}/users${pageQuery(cursor, limit)}`
  );
}

// --- Folders ---

export interface FolderList {
  folders: Folder[];
}

export async function listFolders(mailboxId: string): Promise<{ folders: Folder[] }> {
  return request<{ folders: Folder[] }>("GET", `/mailboxes/${mailboxId}/folders`);
}

export async function createFolder(mailboxId: string, name: string): Promise<{ folder: Folder }> {
  return request<{ folder: Folder }>("POST", `/mailboxes/${mailboxId}/folders`, {
    body: { name }
  });
}

export async function deleteFolder(mailboxId: string, folderId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("DELETE", `/mailboxes/${mailboxId}/folders/${folderId}`);
}

export async function renameFolder(
  mailboxId: string,
  folderId: string,
  name: string
): Promise<{ folder: Folder }> {
  return request<{ folder: Folder }>("PATCH", `/mailboxes/${mailboxId}/folders/${folderId}`, {
    body: { name }
  });
}

// --- Rulesets ---

export interface RulesetList {
  rulesets: Ruleset[];
}

export interface RulesetConditionInput {
  field: RuleField;
  match_type: MatchType;
  condition_value: string;
}

export interface RulesetActionInput {
  action_type: ActionType;
  action_value: string | null;
}

export interface RulesetInput {
  name: string;
  priority: number;
  logic_operator: LogicOperator;
  is_enabled: boolean;
  conditions: RulesetConditionInput[];
  actions: RulesetActionInput[];
}

export async function listRulesets(
  mailboxId: string,
  cursor?: string,
  limit?: number
): Promise<RequestWithMeta<RulesetList>> {
  return requestWithMeta<RulesetList>(
    "GET",
    `/mailboxes/${mailboxId}/rulesets${pageQuery(cursor, limit)}`
  );
}

export async function createRuleset(
  mailboxId: string,
  body: RulesetInput
): Promise<{ ruleset: RulesetDetail }> {
  return request<{ ruleset: RulesetDetail }>("POST", `/mailboxes/${mailboxId}/rulesets`, { body });
}

export async function getRuleset(
  mailboxId: string,
  rulesetId: string
): Promise<{ ruleset: RulesetDetail }> {
  return request<{ ruleset: RulesetDetail }>(
    "GET",
    `/mailboxes/${mailboxId}/rulesets/${rulesetId}`
  );
}

export async function updateRuleset(
  mailboxId: string,
  rulesetId: string,
  body: RulesetInput
): Promise<{ ruleset: RulesetDetail }> {
  return request<{ ruleset: RulesetDetail }>(
    "PUT",
    `/mailboxes/${mailboxId}/rulesets/${rulesetId}`,
    { body }
  );
}

export async function deleteRuleset(
  mailboxId: string,
  rulesetId: string
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("DELETE", `/mailboxes/${mailboxId}/rulesets/${rulesetId}`);
}

// --- Inbox / messages ---

/**
 * Backend message payload. The inbox service returns messages with their
 * recipient list (`to_addresses`) attached; @runmail/shared `Message` does
 * not carry that field, so it is declared here.
 */
export interface MessageDetail extends Message {
  to_addresses: string[];
}

export interface MessageList {
  messages: MessageDetail[];
}

export async function listMessages(
  mailboxId: string,
  cursor?: string,
  limit?: number
): Promise<RequestWithMeta<MessageList>> {
  return requestWithMeta<MessageList>(
    "GET",
    `/mailboxes/${mailboxId}/messages${pageQuery(cursor, limit)}`
  );
}

export async function getMessage(
  mailboxId: string,
  messageId: string
): Promise<{ message: MessageDetail }> {
  return request<{ message: MessageDetail }>(
    "GET",
    `/mailboxes/${mailboxId}/messages/${messageId}`
  );
}

export async function setMessageRead(
  mailboxId: string,
  messageId: string,
  isRead: boolean
): Promise<{ message: MessageDetail }> {
  return request<{ message: MessageDetail }>(
    "PATCH",
    `/mailboxes/${mailboxId}/messages/${messageId}/read`,
    { body: { is_read: isRead } }
  );
}

export async function setMessageStarred(
  mailboxId: string,
  messageId: string,
  isStarred: boolean
): Promise<{ message: MessageDetail }> {
  return request<{ message: MessageDetail }>(
    "PATCH",
    `/mailboxes/${mailboxId}/messages/${messageId}/star`,
    { body: { is_starred: isStarred } }
  );
}

export async function moveMessage(
  mailboxId: string,
  messageId: string,
  folderId: string
): Promise<{ message: MessageDetail }> {
  return request<{ message: MessageDetail }>(
    "PATCH",
    `/mailboxes/${mailboxId}/messages/${messageId}/move`,
    { body: { folder_id: folderId } }
  );
}

export async function permanentDeleteMessage(
  mailboxId: string,
  messageId: string
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("DELETE", `/mailboxes/${mailboxId}/messages/${messageId}`);
}

/**
 * Raw .eml fetch. The response is `message/rfc822` binary, NOT a JSON
 * envelope, so it bypasses `request` and reads the body as a Blob.
 */
export async function fetchRawEmail(mailboxId: string, messageId: string): Promise<Blob> {
  const res = await performAuthorizedFetch(
    "GET",
    `/mailboxes/${mailboxId}/messages/${messageId}/raw`
  );
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    throw toApiError(res.status, payload);
  }
  return res.blob();
}

// --- Sync ---

export interface SyncDeltaEvent {
  sync_version: number;
  event_type: string;
  message_id: string;
  payload: unknown;
}

export interface SyncDelta {
  events: SyncDeltaEvent[];
  last_sync_version: number;
  has_more: boolean;
  full_resync_required?: boolean;
  min_version?: number;
}

export interface MutationResult {
  mutation_id: number;
  status: "ok" | "rejected";
  error?: string;
}

export interface SyncDeltaQuery {
  last_sync_version?: number;
  last_sync_timestamp?: number;
}

export async function getSyncDelta(mailboxId: string, query?: SyncDeltaQuery): Promise<SyncDelta> {
  const params = new URLSearchParams();
  if (query?.last_sync_version !== undefined) {
    params.set("last_sync_version", String(query.last_sync_version));
  }
  if (query?.last_sync_timestamp !== undefined) {
    params.set("last_sync_timestamp", String(query.last_sync_timestamp));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<SyncDelta>("GET", `/mailboxes/${mailboxId}/sync${suffix}`);
}

export async function postMutations(
  mailboxId: string,
  mutations: SyncMutationItem[]
): Promise<{ results: MutationResult[] }> {
  return request<{ results: MutationResult[] }>("POST", `/mailboxes/${mailboxId}/sync/mutations`, {
    body: { mutations }
  });
}
