<script setup lang="ts">
import LocaleSwitcher from "@/components/topbar/LocaleSwitcher.vue";
import PasswordField from "@/components/forms/PasswordField.vue";
import ThemeSwitcher from "@/components/topbar/ThemeSwitcher.vue";
import Wordmark from "@/components/topbar/Wordmark.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { translateApiError } from "@/i18n/api-errors";
import { isConnectionError, mapValidationErrors, resetFieldErrors } from "@/composables/use-auth-form";
import { Icon } from "@/icons";
import { ApiError } from "@/lib/api";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from "@runmail/shared";
import { useAuthStore } from "@/stores/auth";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const usernameError = ref("");
const passwordError = ref("");
const confirmError = ref("");
const apiError = ref("");
const isSubmitting = ref(false);

function validate(): boolean {
  resetFieldErrors(usernameError, passwordError, confirmError);

  let hasError = false;

  const name = username.value.trim();
  if (!name) {
    usernameError.value = t("auth.errors.setupRequired");
    hasError = true;
  } else if (!USERNAME_PATTERN.test(name)) {
    usernameError.value = t("validation.username.pattern");
    hasError = true;
  }

  if (!password.value) {
    passwordError.value = t("auth.errors.setupRequired");
    hasError = true;
  } else if (password.value.length < PASSWORD_MIN_LENGTH) {
    passwordError.value = t("validation.password.min");
    hasError = true;
  } else if (password.value.length > PASSWORD_MAX_LENGTH) {
    passwordError.value = t("validation.password.max");
    hasError = true;
  }

  if (!confirmPassword.value) {
    confirmError.value = t("auth.errors.setupRequired");
    hasError = true;
  } else if (confirmPassword.value !== password.value) {
    confirmError.value = t("auth.errors.setupMismatch");
    hasError = true;
  }

  return !hasError;
}

async function handleSubmit() {
  apiError.value = "";
  if (!validate()) return;

  isSubmitting.value = true;

  try {
    await authStore.setup(username.value.trim(), password.value);
    await router.push("/mailboxes");
  } catch (err) {
    isSubmitting.value = false;
    if (isConnectionError(err)) {
      apiError.value = t("auth.errors.network");
      return;
    }

    if (err instanceof ApiError) {
      const mapped = mapValidationErrors(err.details, {
        username: usernameError,
        password: passwordError,
        confirmPassword: confirmError,
        confirm_password: confirmError,
      });
      if (!mapped) {
        apiError.value = translateApiError(err);
      }
    }
  }
}
</script>

<template>
  <main class="relative flex min-h-screen flex-col items-center justify-center bg-background p-6">
    <div class="flex absolute top-6 right-6 gap-3">
      <ThemeSwitcher />
      <LocaleSwitcher />
    </div>

    <Wordmark size="lg" class="mb-8" />

    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{{ t("auth.setup.title") }}</CardTitle>
        <CardDescription>{{ t("auth.setup.description") }}</CardDescription>
      </CardHeader>

      <CardContent class="flex flex-col gap-4">
        <Alert v-if="apiError" variant="destructive">{{ apiError }}</Alert>

        <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">
              {{ t("auth.setup.username") }}
            </span>
            <Input
              v-model="username"
              :placeholder="t('auth.setup.usernamePlaceholder')"
              :disabled="isSubmitting"
              :aria-invalid="Boolean(usernameError)"
            />
            <p v-if="usernameError" class="text-sm text-destructive">{{ usernameError }}</p>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">
              {{ t("auth.setup.password") }}
            </span>
            <PasswordField
              v-model="password"
              :placeholder="t('auth.setup.passwordPlaceholder')"
              :disabled="isSubmitting"
            />
            <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">
              {{ t("auth.setup.confirmPassword") }}
            </span>
            <PasswordField
              v-model="confirmPassword"
              :placeholder="t('auth.setup.confirmPasswordPlaceholder')"
              :disabled="isSubmitting"
            />
            <p v-if="confirmError" class="text-sm text-destructive">{{ confirmError }}</p>
          </label>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            <Icon v-if="isSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("auth.setup.submit") }}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  </main>
</template>
