<script setup lang="ts">
import NavItem from "@/components/app/NavItem.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

const route = useRoute();
const { t } = useI18n();

const adminNav = computed(() => [
  { label: t("shell.adminSidebar.domains"), to: "/admin/domains", icon: "lucide:globe" },
  { label: t("shell.adminSidebar.mailboxes"), to: "/admin/mailboxes", icon: "lucide:mail" },
  { label: t("shell.adminSidebar.users"), to: "/admin/users", icon: "lucide:users" },
]);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-4">
    <nav class="min-h-0 flex-1 overflow-y-auto" :aria-label="t('shell.adminSidebar.navLabel')">
      <div class="flex flex-col gap-1">
        <NavItem
          v-for="item in adminNav"
          :key="item.to"
          :label="item.label"
          :icon="item.icon"
          :to="item.to"
          :active="route.path.startsWith(item.to)"
          active-class="bg-accent text-accent-foreground font-semibold"
        />
      </div>
    </nav>

    <div class="mt-auto shrink-0 border-t pt-3">
      <NavItem
        :label="t('shell.adminSidebar.backToMailboxes')"
        icon="lucide:arrow-left"
        to="/mailboxes"
      />
    </div>
  </div>
</template>
