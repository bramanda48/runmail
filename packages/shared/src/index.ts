// contracts

export type { ApiError, ApiMeta, ApiSuccess } from "./contracts/envelope";
export type { ApiErrorCode } from "./contracts/errors";
export { API_ERROR_CODES, apiError } from "./contracts/errors";
export type {
  IdCursorPayload,
  MessageCursorPayload,
  PageMeta
} from "./contracts/pagination";
export {
  buildIdCursor,
  buildMessageCursor,
  buildPageMeta,
  decodeCursor,
  encodeCursor,
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT
} from "./contracts/pagination";
export type {
  Domain,
  DomainVerificationStatus,
  VerifyDomainResponse
} from "./types/domain";
export type { Folder, FolderType } from "./types/folder";
export type { Mailbox, MailboxWithDomain } from "./types/mailbox";
export type { MailboxLinkedUser, MailboxUserLink } from "./types/mailboxUser";
export type { Message } from "./types/message";
export type { MessageRecipient, RecipientType } from "./types/messageRecipient";
// types
export type { Role } from "./types/role";
export type {
  Ruleset,
  RulesetAction,
  RulesetCondition,
  RulesetDetail
} from "./types/ruleset";
export type {
  MessageCreatedPayload,
  MessageDeletedPayload,
  MessageMovedPayload,
  MessageUpdatedChanges,
  MessageUpdatedPayload,
  SyncEventPayload,
  SyncEventType
} from "./types/syncEvent";
export { SYNC_EVENT_TYPES } from "./types/syncEvent";
export type { User } from "./types/user";
export type { CursorQuery } from "./validation/cursor";
export { cursorQuerySchema } from "./validation/cursor";
// validation
export {
  DOMAIN_LABEL_MAX_LENGTH,
  DOMAIN_MAX_LENGTH,
  domainNameSchema
} from "./validation/domainName";
export {
  FOLDER_NAME_MAX_LENGTH,
  FOLDER_NAME_MIN_LENGTH,
  folderNameSchema,
  isReservedFolderName,
  isSystemFolder,
  RESERVED_FOLDER_NAMES,
  SYSTEM_FOLDER_NAMES
} from "./validation/folderName";
export {
  LOCAL_PART_MAX_LENGTH,
  LOCAL_PART_MIN_LENGTH,
  LOCAL_PART_PATTERN,
  localPartSchema
} from "./validation/localPart";
export type { LoginInput } from "./validation/login";
export { loginSchema } from "./validation/login";
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema
} from "./validation/password";
export type {
  ActionType,
  LogicOperator,
  MatchType,
  RuleField
} from "./validation/ruleset";
export {
  ACTION_TYPES,
  CONDITION_VALUE_MAX_LENGTH,
  LOGIC_OPERATORS,
  MATCH_TYPES,
  RULE_FIELDS,
  rulesetActionSchema,
  rulesetConditionSchema,
  rulesetSchema,
  validateRegexSafe
} from "./validation/ruleset";
export type {
  MutationType,
  SyncMutationInput,
  SyncMutationItem
} from "./validation/syncMutation";
export {
  MUTATION_TYPES,
  syncMutationItemSchema,
  syncMutationSchema
} from "./validation/syncMutation";
export { USERNAME_PATTERN, usernameSchema } from "./validation/username";
