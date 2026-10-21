// contracts

export type { ApiError, ApiMeta, ApiSuccess } from "./contracts/envelope";
export { API_ERROR_CODES, apiError } from "./contracts/errors";
export type { ApiErrorCode } from "./contracts/errors";
export {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  buildIdCursor,
  buildMessageCursor,
  buildPageMeta,
  decodeCursor,
  encodeCursor,
} from "./contracts/pagination";
export type { IdCursorPayload, MessageCursorPayload, PageMeta } from "./contracts/pagination";
export type { Domain, DomainVerificationStatus, VerifyDomainResponse } from "./types/domain";
export type { Folder, FolderType } from "./types/folder";
export type { Mailbox, MailboxWithDomain } from "./types/mailbox";
export type { MailboxLinkedUser, MailboxUserLink } from "./types/mailbox-user";
export type { Message } from "./types/message";
export type { MessageRecipient, RecipientType } from "./types/message-recipient";
// types
export type { Role } from "./types/role";
export type { Ruleset, RulesetAction, RulesetCondition, RulesetDetail } from "./types/ruleset";
export { SYNC_EVENT_TYPES } from "./types/sync-event";
export type {
  MessageCreatedPayload,
  MessageDeletedPayload,
  MessageMovedPayload,
  MessageUpdatedChanges,
  MessageUpdatedPayload,
  SyncEventPayload,
  SyncEventType,
} from "./types/sync-event";
export type { User } from "./types/user";
export { cursorQuerySchema } from "./validation/cursor";
export type { CursorQuery } from "./validation/cursor";
// validation
export {
  DOMAIN_LABEL_MAX_LENGTH,
  DOMAIN_MAX_LENGTH,
  domainNameSchema,
} from "./validation/domain-name";
export {
  FOLDER_NAME_MAX_LENGTH,
  FOLDER_NAME_MIN_LENGTH,
  RESERVED_FOLDER_NAMES,
  SYSTEM_FOLDER_KEYS,
  folderNameSchema,
  isReservedFolderName,
  isSystemFolderKey,
} from "./validation/folder-name";
export type { SystemFolderKey } from "./validation/folder-name";
export {
  LOCAL_PART_MAX_LENGTH,
  LOCAL_PART_MIN_LENGTH,
  LOCAL_PART_PATTERN,
  localPartSchema,
} from "./validation/local-part";
export { loginSchema } from "./validation/login";
export type { LoginInput } from "./validation/login";
export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordSchema } from "./validation/password";
export {
  ACTION_TYPES,
  CONDITION_VALUE_MAX_LENGTH,
  LOGIC_OPERATORS,
  MATCH_TYPES,
  RULE_FIELDS,
  rulesetActionSchema,
  rulesetConditionSchema,
  rulesetSchema,
  validateRegexSafe,
} from "./validation/ruleset";
export type { ActionType, LogicOperator, MatchType, RuleField } from "./validation/ruleset";
export {
  MUTATION_TYPES,
  syncMutationItemSchema,
  syncMutationSchema,
} from "./validation/sync-mutation";
export type { MutationType, SyncMutationInput, SyncMutationItem } from "./validation/sync-mutation";
export { USERNAME_PATTERN, usernameSchema } from "./validation/username";
