<script setup lang="ts">
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useMailboxAccessStore } from "@/stores/mailbox-access";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
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

const itemClass =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

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
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="t('shell.accountMenu.trigger')"
      class="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {{ initials }}
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="relative z-50 min-w-56 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
      >
        <DropdownMenuLabel class="px-2 py-1.5">
          <p class="truncate text-sm font-medium">{{ username }}</p>
          <p v-if="address" class="truncate text-xs text-muted-foreground">{{ address }}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator class="-mx-1 my-1 h-px bg-border" />

        <DropdownMenuItem :class="itemClass" @select="go('/profile')">
          <Icon icon="lucide:settings" class="size-4 text-muted-foreground" />
          {{ t("shell.accountMenu.profile") }}
        </DropdownMenuItem>
        <DropdownMenuItem :class="itemClass" @select="go('/mailboxes')">
          <Icon icon="lucide:layout-grid" class="size-4 text-muted-foreground" />
          {{ t("shell.accountMenu.switchMailbox") }}
        </DropdownMenuItem>
        <template v-if="isAdmin">
          <DropdownMenuSeparator class="-mx-1 my-1 h-px bg-border" />
          <DropdownMenuItem :class="itemClass" @select="go('/admin/domains')">
            <Icon icon="lucide:shield" class="size-4 text-muted-foreground" />
            {{ t("shell.accountMenu.adminMenu") }}
          </DropdownMenuItem>
        </template>
        <DropdownMenuSeparator class="-mx-1 my-1 h-px bg-border" />
        <DropdownMenuItem
          :class="cn(itemClass, 'text-destructive focus:text-destructive')"
          @select="logout"
        >
          <Icon icon="lucide:log-out" class="size-4" />
          {{ t("shell.accountMenu.logout") }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
