<script setup lang="ts">
import AccountMenu from "@/components/app/AccountMenu.vue";
import FolderNavigation from "@/components/app/FolderNavigation.vue";
import LocaleSwitcher from "@/components/app/LocaleSwitcher.vue";
import MailboxSearchBar from "@/components/app/MailboxSearchBar.vue";
import MailboxSidebar from "@/components/app/MailboxSidebar.vue";
import MobileNavDrawer from "@/components/app/MobileNavDrawer.vue";
import Wordmark from "@/components/app/Wordmark.vue";
import AccessoryRail from "@/components/email/AccessoryRail.vue";
import { Button } from "@/components/ui/button";
import type { LocalFolder } from "@/db/mailbox-db";
import { Icon } from "@/icons";
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
  <div
    class="flex h-screen flex-col overflow-hidden bg-background text-sm"
    style="
      background-image: url(&quot;https://ssl.gstatic.com/ui/v1/icons/mail/images/2/5/android/bg.png&quot;);
      background-repeat: repeat-x;
      background-position: left top;
    "
  >
    <header class="flex h-16 shrink-0 items-center justify-between gap-4 px-4">
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

      <div class="flex shrink-0 items-center gap-4 lg:w-64 lg:justify-end">
        <Button
          :as="RouterLink"
          :to="`/mailboxes/${mailboxId}/settings`"
          variant="ghost"
          size="icon"
          :aria-label="t('shell.mailboxWorkspace.settings')"
        >
          <Icon icon="lucide:settings" />
        </Button>
        <LocaleSwitcher />
        <AccountMenu />
      </div>
    </header>

    <div class="relative flex min-w-0 flex-1 gap-0 overflow-hidden">
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
