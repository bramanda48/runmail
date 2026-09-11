import type { ApiErrorCode } from "./errors";

export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiMeta {
  next_cursor: string | null;
  has_more: boolean;
  total?: number;
}
