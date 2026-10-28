<script setup lang="ts">
import AccountMenu from "@/components/app/AccountMenu.vue";
import FolderNavigation from "@/components/app/FolderNavigation.vue";
import LocaleSwitcher from "@/components/app/LocaleSwitcher.vue";
import MailboxSearchBar from "@/components/app/MailboxSearchBar.vue";
import MailboxSidebar from "@/components/app/MailboxSidebar.vue";
import MobileNavDrawer from "@/components/app/MobileNavDrawer.vue";
import ThemeSwitcher from "@/components/app/ThemeSwitcher.vue";
import Wordmark from "@/components/app/Wordmark.vue";
import AccessoryRail from "@/components/email/AccessoryRail.vue";
import { Button } from "@/components/ui/button";
import type { LocalFolder } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { useThemeStore } from "@/stores/theme";
import { storeToRefs } from "pinia";
import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";

defineProps<{
  mailboxId: string;
  folders: LocalFolder[];
  unreadCounts: Record<string, number>;
  /** When false, typing only updates the model; search fires on Enter. */
  liveSearch?: boolean;
}>();

const searchQuery = defineModel<string>("searchQuery", { default: "" });

const { t } = useI18n();

const { backgroundImage } = storeToRefs(useThemeStore());

const emits = defineEmits<{
  search: [value: string];
  compose: [];
}>();

const drawerOpen = shallowRef(false);
const sidebarCollapsed = shallowRef(false);

function toggleSidebar() {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  } else {
    drawerOpen.value = true;
  }
}

function onSearch(value: string) {
  emits("search", value);
}
</script>

<template>
  <div class="relative flex h-screen flex-col overflow-hidden bg-background text-sm">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-[325px] bg-repeat-x bg-top-left"
      :style="{ backgroundImage }"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-[325px] rotate-180 bg-repeat-x bg-top-left"
      :style="{ backgroundImage }"
    />
    <header class="relative z-10 flex h-16 shrink-0 items-center justify-between gap-4 px-4">
      <div class="flex w-auto min-w-0 shrink-0 items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          :aria-label="t('shell.topbar.toggleMenu')"
          @click="toggleSidebar"
        >
          <Icon icon="lucide:menu" />
        </Button>
        <Wordmark size="lg" />
      </div>

      <div class="max-w-2xl flex-1 px-4">
        <MailboxSearchBar
          v-model="searchQuery"
          :placeholder="t('shell.mailboxWorkspace.searchPlaceholder')"
          :live-search="liveSearch"
          @search="onSearch"
        />
      </div>

      <div class="flex gap-4">
        <div class="flex shrink-0 items-center gap-1">
          <LocaleSwitcher />
          <ThemeSwitcher />
          <Button
            as-child
            :aria-label="t('shell.mailboxWorkspace.settings')"
            variant="link"
            class="text-muted-foreground hover:text-accent-foreground"
          >
            <RouterLink :to="`/mailboxes/${mailboxId}/settings`">
              <Icon icon="lucide:settings" class="size-5!" />
            </RouterLink>
          </Button>
        </div>
        <AccountMenu />
      </div>
    </header>

    <div class="relative z-10 flex min-w-0 flex-1 gap-0 overflow-hidden">
      <aside v-if="!sidebarCollapsed" class="hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
        <MailboxSidebar show-compose @compose="emits('compose')">
          <FolderNavigation
            :mailbox-id="mailboxId"
            :folders="folders"
            :unread-counts="unreadCounts"
          />
        </MailboxSidebar>
      </aside>

      <MobileNavDrawer v-model:open="drawerOpen">
        <MailboxSidebar show-compose @compose="emits('compose')">
          <FolderNavigation
            :mailbox-id="mailboxId"
            :folders="folders"
            :unread-counts="unreadCounts"
          />
        </MailboxSidebar>
      </MobileNavDrawer>

      <main
        class="z-10 mx-0 mt-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-t-3xl shadow-xs border bg-background"
      >
        <slot />
      </main>

      <div class="hidden shrink-0 md:flex">
        <AccessoryRail />
      </div>

      <slot name="overlays" />
    </div>
  </div>
</template>
