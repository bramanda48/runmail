<script setup lang="ts">
import Wordmark from "@/components/app/wordmark.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Icon } from "@/icons";
import { ApiError, listMailboxes } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const usernameError = ref("");
const passwordError = ref("");
const apiError = ref("");
const isSubmitting = ref(false);

const showRedirectInfo = computed(() => Boolean(route.query.redirect));

async function handleSubmit() {
  usernameError.value = "";
  passwordError.value = "";
  apiError.value = "";

  let hasError = false;
  if (!username.value.trim()) {
    usernameError.value = "Username wajib diisi";
    hasError = true;
  }
  if (!password.value) {
    passwordError.value = "Kata sandi wajib diisi";
    hasError = true;
  }
  if (hasError) return;

  isSubmitting.value = true;

  try {
    await auth.login(username.value.trim(), password.value);

    const redirect = route.query.redirect;
    if (
      typeof redirect === "string" &&
      redirect.startsWith("/") &&
      !redirect.startsWith("/login")
    ) {
      await router.push(redirect);
      return;
    }

    try {
      const { data, meta } = await listMailboxes(undefined, 10);
      const boxes = data.mailboxes;
      if (boxes.length === 1 && !meta?.has_more && boxes[0].is_active) {
        await router.push(`/mailboxes/${boxes[0].id}/inbox`);
        return;
      }
    } catch {
      // If the mailbox list cannot be loaded, fall back to the selection screen.
    }

    await router.push("/mailboxes");
  } catch (err) {
    isSubmitting.value = false;
    if (err instanceof ApiError) {
      apiError.value =
        err.status === 0 ? "Tidak dapat terhubung ke server. Coba lagi." : err.message;
    } else {
      apiError.value = "Tidak dapat terhubung ke server. Coba lagi.";
    }
  }
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center bg-background p-6">
    <Wordmark size="lg" class="mb-8" />

    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Masuk untuk melanjutkan ke kotak surat Anda.</CardDescription>
      </CardHeader>

      <CardContent class="flex flex-col gap-4">
        <Alert v-if="showRedirectInfo" variant="info">
          Sesi Anda berakhir, silakan masuk kembali.
        </Alert>

        <Alert v-if="apiError" variant="error">{{ apiError }}</Alert>

        <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">Username</span>
            <Input
              v-model="username"
              placeholder="Masukkan username"
              :disabled="isSubmitting"
              :variant="usernameError ? 'error' : 'default'"
            />
            <p v-if="usernameError" class="text-sm text-destructive">{{ usernameError }}</p>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">Kata Sandi</span>
            <PasswordInput
              v-model="password"
              placeholder="Masukkan kata sandi"
              :disabled="isSubmitting"
              :variant="passwordError ? 'error' : 'default'"
            />
            <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>
          </label>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            <Icon v-if="isSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Masuk</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  </main>
</template>
