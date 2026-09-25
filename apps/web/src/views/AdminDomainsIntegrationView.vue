<script setup lang="ts">
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { ApiError, completeCloudflareOAuthCallback } from "@/lib/api";
import { nextTick, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const errorMessage = ref("");
const errorPanel = ref<HTMLElement | null>(null);

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
  await nextTick();
  errorPanel.value?.focus();
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
    await showError("Invalid callback URL");
    return;
  }

  try {
    await completeCloudflareOAuthCallback(code, state);
    await router.replace("/admin/domains");
  } catch (error) {
    if (error instanceof ApiError) {
      await showError(error.message);
      return;
    }
    await showError("Tidak dapat menyelesaikan koneksi Cloudflare.");
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
      <p class="text-base font-medium text-foreground">Menghubungkan Cloudflare...</p>
    </section>

    <section
      v-else
      ref="errorPanel"
      class="flex w-full max-w-md flex-col items-stretch gap-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
      tabindex="-1"
      aria-labelledby="oauth-error-title"
      aria-describedby="oauth-error-message"
    >
      <Alert variant="error" class="items-start">
        <div class="min-w-0">
          <h1 id="oauth-error-title" class="font-semibold">Gagal menghubungkan Cloudflare</h1>
          <p id="oauth-error-message" class="mt-1 wrap-break-words">{{ errorMessage }}</p>
        </div>
      </Alert>
      <Button class="min-h-11 w-full" @click="returnToDomains">
        Kembali ke Domain Management
      </Button>
    </section>
  </main>
</template>
