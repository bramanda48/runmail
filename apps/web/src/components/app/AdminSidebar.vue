<script setup lang="ts">
import NavItem from "@/components/app/NavItem.vue";
import { useRoute } from "vue-router";

const route = useRoute();

const adminNav = [
  { label: "Domain", to: "/admin/domains", icon: "lucide:globe" },
  { label: "Mailbox", to: "/admin/mailboxes", icon: "lucide:mail" },
  { label: "User", to: "/admin/users", icon: "lucide:users" },
];
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-4">
    <nav class="min-h-0 flex-1 overflow-y-auto" aria-label="Navigasi admin">
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
      <NavItem label="Kembali ke Mailbox" icon="lucide:arrow-left" to="/mailboxes" />
    </div>
  </div>
</template>
