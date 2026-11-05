import type { ComposeDraft } from "@/components/email/compose/ComposeModal.vue";
import type { LocalMessage } from "@/db/mailbox-db";
import { ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";

/**
 * Reply/forward/blank compose draft state for the detail view.
 */
export function useComposeDraft(message: Ref<LocalMessage | null>, bodyText: Ref<string>) {
  const { t } = useI18n();

  const composeOpen = shallowRef(false);
  const composeDraft = ref<ComposeDraft | null>(null);

  function quoteBody(): string {
    return bodyText.value
      ? `\n\n---\n${bodyText.value}`
      : `\n\n---\n${t("message.quote.htmlOnly")}`;
  }

  function openReply() {
    if (!message.value) return;
    const prefix = t("message.subjectPrefix.reply");
    const subject = message.value.subject.startsWith(prefix)
      ? message.value.subject
      : `${prefix} ${message.value.subject}`;
    composeDraft.value = {
      to: message.value.from_address,
      subject,
      body: quoteBody(),
      title: t("message.reply"),
    };
    composeOpen.value = true;
  }

  function openForward() {
    if (!message.value) return;
    const prefix = t("message.subjectPrefix.forward");
    const subject = message.value.subject.startsWith(prefix)
      ? message.value.subject
      : `${prefix} ${message.value.subject}`;
    composeDraft.value = {
      to: "",
      subject,
      body: quoteBody(),
      title: t("message.forward"),
    };
    composeOpen.value = true;
  }

  function openCompose() {
    composeDraft.value = null;
    composeOpen.value = true;
  }

  return {
    composeOpen,
    composeDraft,
    quoteBody,
    openReply,
    openForward,
    openCompose,
  };
}
