<script setup lang="ts">
import PasswordField from "@/components/forms/PasswordField.vue";
import MemberShell from "@/components/layouts/MemberShell.vue";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mapValidationErrors, resetFieldErrors } from "@/composables/use-auth-form";
import { translateApiError } from "@/i18n/api-errors";
import { Icon } from "@/icons";
import { ApiError, changePassword } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@runmail/shared";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

const currentPasswordError = ref("");
const newPasswordError = ref("");
const confirmPasswordError = ref("");
const inlineError = ref("");
const successMessage = ref("");
const isSubmitting = ref(false);

function clearErrors() {
  resetFieldErrors(currentPasswordError, newPasswordError, confirmPasswordError, inlineError);
}

function applyApiError(err: ApiError) {
  if (err.code === "INVALID_CREDENTIALS") {
    currentPasswordError.value = translateApiError(err);
    return;
  }
  if (err.code === "VALIDATION_ERROR") {
    mapValidationErrors(err.details, {
      current_password: currentPasswordError,
      new_password: newPasswordError,
    });
    return;
  }
  inlineError.value = translateApiError(err);
}

async function handleChangePassword() {
  clearErrors();
  successMessage.value = "";

  let hasError = false;
  if (!currentPassword.value) {
    currentPasswordError.value = t("validation.login.passwordRequired");
    hasError = true;
  }
  if (
    newPassword.value.length < PASSWORD_MIN_LENGTH ||
    newPassword.value.length > PASSWORD_MAX_LENGTH
  ) {
    newPasswordError.value =
      newPassword.value.length > PASSWORD_MAX_LENGTH
        ? t("validation.password.max")
        : t("validation.password.min");
    hasError = true;
  }
  if (newPassword.value !== confirmPassword.value) {
    confirmPasswordError.value = t("profile.password.mismatch");
    hasError = true;
  }
  if (hasError) return;

  isSubmitting.value = true;
  try {
    await changePassword(currentPassword.value, newPassword.value);
    successMessage.value = t("profile.password.success");
    setTimeout(async () => {
      // All refresh tokens were revoked server-side; wipe local session data
      // without a pointless logout request.
      await authStore.endSessionLocally();
      await router.push("/login");
    }, 1500);
  } catch (err) {
    isSubmitting.value = false;
    if (err instanceof ApiError) {
      applyApiError(err);
    } else {
      inlineError.value = t("profile.password.networkError");
    }
  }
}
</script>

<template>
  <MemberShell>
    <div class="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="scroll-m-20 text-3xl font-extrabold tracking-tight text-foreground">
          {{ t("profile.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">{{ t("profile.subtitle") }}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{{ t("profile.account.title") }}</CardTitle>
          <CardDescription>{{ t("profile.account.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-2">
              <p class="text-sm text-muted-foreground">{{ t("profile.account.username") }}</p>
              <div class="flex items-center justify-between">
                <p class="font-medium text-foreground">{{ authStore.user?.username }}</p>
                <Badge :variant="authStore.isAdmin ? 'secondary' : 'outline'">
                  {{
                    authStore.isAdmin
                      ? t("profile.account.role.admin")
                      : t("profile.account.role.member")
                  }}
                </Badge>
              </div>
            </div>
            <div v-if="authStore.user?.teams?.length">
              <p class="text-sm text-muted-foreground">{{ t("profile.account.teams") }}</p>
              <ul class="mt-2 flex flex-wrap gap-1.5">
                <li v-for="team in authStore.user.teams" :key="team.id">
                  <Badge variant="secondary">
                    {{ team.name }}
                  </Badge>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t("profile.password.title") }}</CardTitle>
          <CardDescription>{{ t("profile.password.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Alert v-if="inlineError" variant="destructive">{{ inlineError }}</Alert>
          <Alert v-if="successMessage">{{ successMessage }}</Alert>

          <form class="flex flex-col gap-4" @submit.prevent="handleChangePassword">
            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-foreground">
                {{ t("profile.password.currentLabel") }}
              </span>
              <PasswordField
                v-model="currentPassword"
                :placeholder="t('profile.password.currentPlaceholder')"
                :disabled="isSubmitting"
              />
              <p v-if="currentPasswordError" class="text-sm text-destructive">
                {{ currentPasswordError }}
              </p>
            </label>

            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-foreground">
                {{ t("profile.password.newLabel") }}
              </span>
              <PasswordField
                v-model="newPassword"
                :placeholder="t('profile.password.newPlaceholder', { min: PASSWORD_MIN_LENGTH })"
                :disabled="isSubmitting"
              />
              <p class="text-xs text-muted-foreground">
                {{
                  t("profile.password.newHint", {
                    min: PASSWORD_MIN_LENGTH,
                    max: PASSWORD_MAX_LENGTH,
                  })
                }}
              </p>
              <p v-if="newPasswordError" class="text-sm text-destructive">
                {{ newPasswordError }}
              </p>
            </label>

            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-foreground">
                {{ t("profile.password.confirmLabel") }}
              </span>
              <PasswordField
                v-model="confirmPassword"
                :placeholder="t('profile.password.confirmPlaceholder')"
                :disabled="isSubmitting"
              />
              <p v-if="confirmPasswordError" class="text-sm text-destructive">
                {{ confirmPasswordError }}
              </p>
            </label>

            <Button type="submit" class="w-full" :disabled="isSubmitting">
              <Icon v-if="isSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>{{ t("profile.password.submit") }}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </MemberShell>
</template>
