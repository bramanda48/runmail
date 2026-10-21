<script setup lang="ts">
import AccountMenu from "@/components/app/AccountMenu.vue";
import LocaleSwitcher from "@/components/app/LocaleSwitcher.vue";
import MobileNavDrawer from "@/components/app/MobileNavDrawer.vue";
import MemberSidebar from "@/components/app/MemberSidebar.vue";
import Wordmark from "@/components/app/Wordmark.vue";
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const drawerOpen = shallowRef(false);
const sidebarCollapsed = shallowRef(false);

function toggleSidebar() {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  } else {
    drawerOpen.value = true;
  }
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

      <!-- spacer to keep right-aligned AccountMenu same position as mail -->
      <div class="hidden max-w-2xl flex-1 px-4 lg:block" aria-hidden="true" />

      <div class="flex shrink-0 items-center gap-4 lg:w-64 lg:justify-end">
        <LocaleSwitcher />
        <AccountMenu />
      </div>
    </header>

    <div class="relative flex min-w-0 flex-1 gap-0 overflow-hidden">
      <aside v-if="!sidebarCollapsed" class="hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
        <MemberSidebar />
      </aside>

      <MobileNavDrawer v-model:open="drawerOpen">
        <MemberSidebar />
      </MobileNavDrawer>

      <main
        class="z-10 mx-0 mt-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-t-3xl border bg-background shadow-xs"
      >
        <div class="min-w-0 flex-1 overflow-y-auto p-4 lg:p-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
