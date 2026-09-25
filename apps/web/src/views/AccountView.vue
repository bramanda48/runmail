<script setup lang="ts">
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { Icon } from "@/icons";
import { ApiError, changePassword } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { ref } from "vue";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

const currentPasswordError = ref("");
const newPasswordError = ref("");
const confirmPasswordError = ref("");
const inlineError = ref("");
const successMessage = ref("");
const isSubmitting = ref(false);
const isLoggingOut = ref(false);
const logoutOpen = ref(false);

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function clearErrors() {
  currentPasswordError.value = "";
  newPasswordError.value = "";
  confirmPasswordError.value = "";
  inlineError.value = "";
}

function applyApiError(err: ApiError) {
  if (err.code === "INVALID_CREDENTIALS") {
    currentPasswordError.value = err.message;
    return;
  }
  if (err.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") {
    const details = err.details as Record<string, string[]>;
    if (details.current_password?.length) {
      currentPasswordError.value = details.current_password[0];
    }
    if (details.new_password?.length) {
      newPasswordError.value = details.new_password[0];
    }
    return;
  }
  inlineError.value = err.message || "Terjadi kesalahan. Coba lagi.";
}

async function handleChangePassword() {
  clearErrors();
  successMessage.value = "";

  let hasError = false;
  if (!currentPassword.value) {
    currentPasswordError.value = "Kata sandi saat ini wajib diisi";
    hasError = true;
  }
  if (newPassword.value.length < PASSWORD_MIN || newPassword.value.length > PASSWORD_MAX) {
    newPasswordError.value = `Kata sandi baru harus ${PASSWORD_MIN}–${PASSWORD_MAX} karakter`;
    hasError = true;
  }
  if (newPassword.value !== confirmPassword.value) {
    confirmPasswordError.value = "Konfirmasi kata sandi tidak cocok";
    hasError = true;
  }
  if (hasError) return;

  isSubmitting.value = true;
  try {
    await changePassword(currentPassword.value, newPassword.value);
    successMessage.value = "Kata sandi berhasil diganti. Anda akan diminta masuk kembali.";
    setTimeout(async () => {
      // All refresh tokens were revoked server-side; wipe local session data
      // without a pointless logout request.
      await auth.endSessionLocally();
      await router.push("/login");
    }, 1500);
  } catch (err) {
    isSubmitting.value = false;
    if (err instanceof ApiError) {
      applyApiError(err);
    } else {
      inlineError.value = "Tidak dapat terhubung ke server. Coba lagi.";
    }
  }
}

async function confirmLogout() {
  isLoggingOut.value = true;
  await auth.logout();
  await router.push("/login");
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center bg-background p-6">
    <div class="w-full max-w-2xl flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-semibold text-foreground">Akun</h1>
        <p class="text-sm text-muted-foreground">Kelola informasi akun dan keamanan Anda.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Informasi akun Anda saat ini.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Username</p>
              <p class="font-medium text-foreground">{{ auth.user?.username }}</p>
            </div>
            <Badge :variant="auth.isAdmin ? 'success' : 'inactive'">
              {{ auth.isAdmin ? "Admin" : "Member" }}
            </Badge>
          </div>

          <DialogRoot v-model:open="logoutOpen">
            <DialogTrigger as-child>
              <Button variant="destructive" class="w-full sm:w-auto">
                <Icon icon="lucide:log-out" />
                <span>Keluar</span>
              </Button>
            </DialogTrigger>
            <DialogContent variant="destructive" size="sm">
              <DialogHeader>
                <DialogTitle>Keluar</DialogTitle>
                <DialogDescription>Apakah Anda yakin ingin keluar?</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" @click="logoutOpen = false">Batal</Button>
                <Button variant="destructive" :disabled="isLoggingOut" @click="confirmLogout">
                  <Icon v-if="isLoggingOut" icon="lucide:loader-circle" class="animate-spin" />
                  <span>Keluar</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </DialogRoot>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubah Kata Sandi</CardTitle>
          <CardDescription>
            Setelah berhasil, Anda harus masuk kembali karena semua sesi akan diakhiri.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Alert v-if="inlineError" variant="error">{{ inlineError }}</Alert>
          <Alert v-if="successMessage" variant="success">{{ successMessage }}</Alert>

          <form class="flex flex-col gap-4" @submit.prevent="handleChangePassword">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium text-foreground">Kata Sandi Saat Ini</span>
              <PasswordInput
                v-model="currentPassword"
                placeholder="Masukkan kata sandi saat ini"
                :disabled="isSubmitting"
                :variant="currentPasswordError ? 'error' : 'default'"
              />
              <p v-if="currentPasswordError" class="text-sm text-destructive">
                {{ currentPasswordError }}
              </p>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium text-foreground">Kata Sandi Baru</span>
              <PasswordInput
                v-model="newPassword"
                placeholder="Minimal 8 karakter"
                :disabled="isSubmitting"
                :variant="newPasswordError ? 'error' : 'default'"
              />
              <p class="text-xs text-muted-foreground">Kata sandi harus 8–128 karakter.</p>
              <p v-if="newPasswordError" class="text-sm text-destructive">
                {{ newPasswordError }}
              </p>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium text-foreground">Konfirmasi Kata Sandi Baru</span>
              <PasswordInput
                v-model="confirmPassword"
                placeholder="Ulangi kata sandi baru"
                :disabled="isSubmitting"
                :variant="confirmPasswordError ? 'error' : 'default'"
              />
              <p v-if="confirmPasswordError" class="text-sm text-destructive">
                {{ confirmPasswordError }}
              </p>
            </label>

            <Button type="submit" class="w-full" :disabled="isSubmitting">
              <Icon v-if="isSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>Simpan Kata Sandi</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
