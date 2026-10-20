<script setup lang="ts">
import MailboxWorkspace from "@/components/app/MailboxWorkspace.vue";
import ComposeModal from "@/components/email/ComposeModal.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMailboxWorkspace } from "@/composables/use-mailbox-workspace";
import { computed, onMounted, ref, shallowRef, watch } from "vue";

const {
  route,
  router,
  mailboxStore,
  mailboxId,
  localFolders,
  unreadCounts,
  resolveMailbox,
  loadLocalFolders,
  watchSyncStatus,
} = useMailboxWorkspace({
  onResolveError: () => {
    loadError.value = "Tidak dapat memuat mailbox. Coba lagi.";
  },
});

const loadError = ref("");
const composeOpen = shallowRef(false);

/** Route-driven tab state: the URL is the source of truth. */
const isRulesetEditor = computed(
  () => route.name === "settings-ruleset-new" || route.name === "settings-ruleset-edit",
);

const activeTab = computed({
  get: () =>
    route.name === "settings-rulesets" ||
    route.name === "settings-ruleset-new" ||
    route.name === "settings-ruleset-edit"
      ? "rulesets"
      : "folders",
  set: (value: string) => {
    const target = value === "rulesets" ? "settings-rulesets" : "settings-folders";
    if (route.name !== target) {
      router.push({ name: target, params: { mailbox_id: mailboxId.value } });
    }
  },
});

function goBackToRulesets() {
  router.push({ name: "settings-rulesets", params: { mailbox_id: mailboxId.value } });
}

async function init() {
  loadError.value = "";
  await resolveMailbox();
  if (mailboxStore.mailboxId === mailboxId.value) {
    await loadLocalFolders();
  }
}

onMounted(() => init());

watch(mailboxId, () => init());
watchSyncStatus();
</script>

<template>
  <MailboxWorkspace
    :mailbox-id="mailboxId"
    :folders="localFolders"
    :unread-counts="unreadCounts"
    @compose="composeOpen = true"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 lg:p-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="scroll-m-20 text-2xl font-bold tracking-tight text-foreground">Setelan</h1>
        </div>
        <Tabs v-model="activeTab" class="shrink-0">
          <TabsList>
            <TabsTrigger value="folders">Folder</TabsTrigger>
            <TabsTrigger value="rulesets">Ruleset</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div v-if="loadError" class="flex flex-col gap-4">
        <Alert variant="destructive">{{ loadError }}</Alert>
        <Button variant="ghost" @click="init">Coba Lagi</Button>
      </div>

      <RouterView v-else v-slot="{ Component }">
        <component :is="Component" v-if="Component" :mailbox-id="mailboxId" />
      </RouterView>
    </div>

    <template #overlays>
      <div class="absolute bottom-0 right-20 z-50">
        <ComposeModal v-model:open="composeOpen" />
      </div>
    </template>
  </MailboxWorkspace>
</template>
