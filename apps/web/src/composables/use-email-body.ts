import type { EmailBodyState } from "@/components/email/detail/EmailDetailBody.vue";
import { translateApiError } from "@/i18n/api-errors";
import { ApiError, fetchRawEmail } from "@/lib/api";
import { getCachedRaw, putCachedRaw } from "@/lib/raw-cache";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import PostalMime from "postal-mime";
import { computed, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";

export type EmailBodyLoadFailure = { kind: "not-found" } | { kind: "api"; error: ApiError };

export interface EmailAttachment {
  filename?: string;
  mimeType?: string;
  size?: number;
}

/**
 * Raw email fetch → parse → sanitize pipeline with remote-image blocking.
 * Error text follows ApiError ? translateApiError : t(key) pattern.
 */
export function useEmailBody(mailboxId: Ref<string>, messageId: Ref<string>) {
  const { t } = useI18n();

  const bodyState = ref<EmailBodyState>("loading");
  const bodyHtml = ref("");
  const rawHtml = ref("");
  const bodyText = ref("");
  const headers = ref<{ key: string; value: string }[]>([]);
  const attachments = ref<EmailAttachment[]>([]);

  const loadFailure = ref<EmailBodyLoadFailure | null>(null);
  const fetchError = computed(() => {
    const failure = loadFailure.value;
    if (!failure) return "";
    return failure.kind === "not-found" ? t("message.notFound") : translateApiError(failure.error);
  });

  const remoteImagesBlocked = ref(false);
  const imagesAllowed = ref(false);

  function sanitizeWithImageBlock(html: string) {
    const result = sanitizeEmailHtml(html, { allowRemoteContent: false });
    remoteImagesBlocked.value = result.blocked;
    return result.html;
  }

  function sanitizeWithoutImageBlock(html: string) {
    return sanitizeEmailHtml(html, { allowRemoteContent: true }).html;
  }

  async function loadBody() {
    bodyState.value = "loading";
    loadFailure.value = null;
    try {
      const cached = await getCachedRaw(mailboxId.value, messageId.value);
      let blob: Blob;
      if (cached) {
        blob = await cached.blob();
      } else {
        blob = await fetchRawEmail(mailboxId.value, messageId.value);
        await putCachedRaw(mailboxId.value, messageId.value, blob);
      }
      const parsed = await PostalMime.parse(await blob.arrayBuffer());
      headers.value = parsed.headers ?? [];
      attachments.value = (parsed.attachments || []).map((a) => {
        const content = a.content;
        let size: number | undefined;
        if (content instanceof ArrayBuffer) {
          size = content.byteLength;
        } else if (content instanceof Uint8Array) {
          size = content.byteLength;
        } else if (typeof content === "string") {
          size = new Blob([content]).size;
        }
        return {
          filename: a.filename ?? undefined,
          mimeType: a.mimeType ?? undefined,
          size,
        };
      });

      if (parsed.html) {
        rawHtml.value = parsed.html;
        bodyHtml.value = sanitizeWithImageBlock(parsed.html);
        bodyState.value = "html";
      } else if (parsed.text) {
        bodyText.value = parsed.text;
        bodyState.value = "text";
      } else {
        bodyState.value = "empty";
      }
    } catch (err) {
      if (err instanceof ApiError) {
        bodyState.value = "error";
        loadFailure.value = { kind: "api", error: err };
      } else {
        bodyState.value = "parse-error";
      }
    }
  }

  function allowImages() {
    if (!rawHtml.value) return;
    bodyHtml.value = sanitizeWithoutImageBlock(rawHtml.value);
    remoteImagesBlocked.value = false;
    imagesAllowed.value = true;
  }

  function resetBody() {
    imagesAllowed.value = false;
    remoteImagesBlocked.value = false;
    headers.value = [];
  }

  return {
    bodyState,
    bodyHtml,
    rawHtml,
    bodyText,
    headers,
    attachments,
    loadFailure,
    fetchError,
    remoteImagesBlocked,
    imagesAllowed,
    loadBody,
    allowImages,
    resetBody,
  };
}
