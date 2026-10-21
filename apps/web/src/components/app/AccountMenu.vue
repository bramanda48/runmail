<script setup lang="ts">
import { Icon } from "@/icons";
import { useAuthStore } from "@/stores/auth";
import { useMailboxAccessStore } from "@/stores/mailbox-access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const router = useRouter();
const auth = useAuthStore();
const mailboxAccess = useMailboxAccessStore();
const { t } = useI18n();

const username = computed(() => auth.user?.username ?? t("shell.accountMenu.fallbackName"));
const address = computed(() => mailboxAccess.current?.address ?? "");
const isAdmin = computed(() => auth.user?.role === "admin");
const initials = computed(() => {
  const source = address.value || username.value;
  if (!source) return "RM";
  return source.slice(0, 2).toUpperCase() || "RM";
});

function go(to: string) {
  void router.push(to);
}

async function logout() {
  if (window.confirm(t("shell.accountMenu.logoutConfirm"))) {
    await auth.logout();
    await router.push("/login");
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :aria-label="t('shell.accountMenu.trigger')"
      class="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {{ initials }}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :side-offset="8" class="min-w-56">
      <DropdownMenuLabel>
        <p class="truncate text-sm font-medium">{{ username }}</p>
        <p v-if="address" class="truncate text-xs text-muted-foreground">{{ address }}</p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuItem @select="go('/profile')">
        <Icon icon="lucide:settings" class="size-4 text-muted-foreground" />
        {{ t("shell.accountMenu.profile") }}
      </DropdownMenuItem>
      <DropdownMenuItem @select="go('/mailboxes')">
        <Icon icon="lucide:layout-grid" class="size-4 text-muted-foreground" />
        {{ t("shell.accountMenu.switchMailbox") }}
      </DropdownMenuItem>
      <template v-if="isAdmin">
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="go('/admin/domains')">
          <Icon icon="lucide:shield" class="size-4 text-muted-foreground" />
          {{ t("shell.accountMenu.adminMenu") }}
        </DropdownMenuItem>
      </template>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="text-destructive focus:text-destructive" @select="logout">
        <Icon icon="lucide:log-out" class="size-4" />
        {{ t("shell.accountMenu.logout") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
