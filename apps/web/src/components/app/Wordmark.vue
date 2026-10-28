<script setup lang="ts">
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme";
import { storeToRefs } from "pinia";
import { computed } from "vue";

type Size = "sm" | "lg";

interface Props {
  size?: Size;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: "sm",
});

const themeStore = useThemeStore();
const { resolved } = storeToRefs(themeStore);

const logoUrl = computed(() =>
  resolved.value === "dark" ? "/logo/horizontal-dark.svg" : "/logo/horizontal.svg",
);
const logoClass = computed(() => (props.size === "lg" ? "h-8 w-auto" : "h-6 w-auto"));
</script>

<template>
  <RouterLink
    to="/mailboxes"
    :class="cn('inline-flex items-center', props.class)"
    aria-label="Runmail"
  >
    <img :src="logoUrl" alt="Runmail" :class="logoClass" />
  </RouterLink>
</template>
