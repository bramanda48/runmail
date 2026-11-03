import { translateApiError, translateFieldErrors } from "@/i18n/api-errors";
import { ApiError } from "@/lib/api";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

export type FieldErrorMap = Record<string, { value: string; set: (message: string) => void }>;

/**
 * Shared submit lifecycle for admin dialogs:
 * field refs + inline error + isSubmitting, sync validate,
 * ApiError mapped to field errors via code allowlist, fallback inline.
 */
export function useFormSubmit(connectionErrorKey: string, onAuthReset?: (err: unknown) => boolean) {
  const { t } = useI18n();

  const inlineError = ref("");
  const isSubmitting = ref(false);

  function resetErrors(fields: Array<{ value: string; set: (message: string) => void }>) {
    for (const field of fields) field.set("");
    inlineError.value = "";
  }

  function applyApiError(
    err: ApiError,
    fieldCodes: Record<string, string[]>,
    fields: FieldErrorMap,
    fallback?: (err: ApiError) => boolean,
  ) {
    if (onAuthReset?.(err)) return true;
    if (fallback?.(err)) return false;
    if (err.code === "VALIDATION_ERROR") {
      const details = translateFieldErrors(err.details);
      let mapped = false;
      for (const [field, keys] of Object.entries(fieldCodes)) {
        for (const key of keys) {
          const messages = details[key];
          if (messages?.length) {
            fields[field]?.set(messages[0]);
            mapped = true;
            break;
          }
        }
      }
      if (mapped) return false;
    }
    inlineError.value = translateApiError(err);
    return false;
  }

  async function runSubmit(task: () => Promise<void>, onSuccess: () => void): Promise<boolean> {
    if (isSubmitting.value) return false;
    isSubmitting.value = true;
    try {
      await task();
      onSuccess();
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        inlineError.value = translateApiError(err);
      } else {
        inlineError.value = t(connectionErrorKey);
      }
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { inlineError, isSubmitting, resetErrors, applyApiError, runSubmit };
}
