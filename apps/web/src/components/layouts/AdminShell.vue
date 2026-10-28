<script setup lang="ts">
import AccountMenu from "@/components/topbar/AccountMenu.vue";
import AdminSidebar from "@/components/navigation/AdminSidebar.vue";
import LocaleSwitcher from "@/components/topbar/LocaleSwitcher.vue";
import MobileNavDrawer from "@/components/navigation/MobileNavDrawer.vue";
import ThemeSwitcher from "@/components/topbar/ThemeSwitcher.vue";
import Wordmark from "@/components/topbar/Wordmark.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { useThemeStore } from "@/stores/theme";
import { storeToRefs } from "pinia";
import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const { backgroundImage } = storeToRefs(useThemeStore());

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
        <div class="flex items-center gap-2">
          <Wordmark size="lg" />
          <Badge variant="secondary">{{ t("shell.adminBadge") }}</Badge>
        </div>
      </div>

      <!-- spacer to keep right-aligned AccountMenu same position as mail -->
      <div class="hidden max-w-2xl flex-1 px-4 lg:block" aria-hidden="true" />

      <div class="flex gap-4">
        <div class="flex shrink-0 items-center gap-1">
          <LocaleSwitcher />
          <ThemeSwitcher />
        </div>
        <AccountMenu />
      </div>
    </header>

    <div class="relative z-10 flex min-w-0 flex-1 gap-0 overflow-hidden">
      <aside v-if="!sidebarCollapsed" class="hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
        <AdminSidebar />
      </aside>

      <MobileNavDrawer v-model:open="drawerOpen">
        <AdminSidebar />
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
