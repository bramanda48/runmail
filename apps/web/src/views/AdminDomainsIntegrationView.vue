<script setup lang="ts">
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { translateApiError } from "@/i18n/api-errors";
import { Icon } from "@/icons";
import { ApiError, completeCloudflareOAuthCallback } from "@/lib/api";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const errorMessage = ref("");
function queryValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function decodeQueryValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function showError(message: string) {
  isLoading.value = false;
  errorMessage.value = message;
}

async function returnToDomains() {
  await router.push("/admin/domains");
}

async function handleCallback() {
  const cloudflareError = queryValue(route.query.error);
  if (cloudflareError) {
    const description = queryValue(route.query.error_description);
    await showError(decodeQueryValue(description ?? cloudflareError));
    return;
  }

  const code = queryValue(route.query.code);
  const state = queryValue(route.query.state);
  if (!code || !state) {
    await showError(t("admin.integration.invalidCallback"));
    return;
  }

  try {
    await completeCloudflareOAuthCallback(code, state);
    await router.replace("/admin/domains");
  } catch (error) {
    if (error instanceof ApiError) {
      await showError(translateApiError(error));
      return;
    }
    await showError(t("admin.integration.callbackError"));
  }
}

onMounted(() => {
  void handleCallback();
});
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
    <section
      v-if="isLoading"
      class="flex w-full max-w-md flex-col items-center gap-4 text-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon
        icon="lucide:loader-circle"
        class="size-7 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p class="text-base font-medium text-foreground">{{ t("admin.integration.connecting") }}</p>
    </section>

    <section
      v-else
      class="flex w-full max-w-md flex-col items-stretch gap-5"
      aria-labelledby="oauth-error-title"
      aria-describedby="oauth-error-message"
    >
      <Alert variant="destructive" class="items-start">
        <div class="min-w-0">
          <h1 id="oauth-error-title" class="font-semibold">{{ t("admin.integration.errorTitle") }}</h1>
          <p id="oauth-error-message" class="mt-1 wrap-break-words">{{ errorMessage }}</p>
        </div>
      </Alert>
      <Button class="min-h-11 w-full" @click="returnToDomains">
        {{ t("admin.integration.back") }}
      </Button>
    </section>
  </main>
</template>
