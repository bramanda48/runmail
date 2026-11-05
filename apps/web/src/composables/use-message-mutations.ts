import type { LocalFolder, LocalMessage } from "@/db/mailbox-db";
import { useMailboxStore } from "@/stores/mailbox";
import { useMailboxFoldersStore } from "@/stores/mailbox-folders";
import type { PendingMutation } from "@/sync/queue";
import { computed, type Ref } from "vue";

export function useMessageMutations(
  messages: Ref<LocalMessage[]>,
  folders: Ref<LocalFolder[]>,
  onChanged: () => void,
) {
  const mailboxStore = useMailboxStore();
  const foldersStore = useMailboxFoldersStore();

  const trashFolder = computed(() =>
    folders.value.find((f) => f.folder_type === "system" && f.name === "system.trash"),
  );

  async function enqueueAndRefresh(mutation: PendingMutation): Promise<void> {
    await mailboxStore.enqueue(mutation);
    foldersStore.invalidate();
    onChanged();
  }

  function toggleStar(message: LocalMessage): void {
    void enqueueAndRefresh({
      message_id: message.id,
      mutation_type: "star",
      mutation_value: !message.is_starred,
    });
  }

  function toggleRead(message: LocalMessage): void {
    void enqueueAndRefresh({
      message_id: message.id,
      mutation_type: "read",
      mutation_value: !message.is_read,
    });
  }

  async function moveSingle(payload: { message: LocalMessage; folderId: string }): Promise<void> {
    await enqueueAndRefresh({
      message_id: payload.message.id,
      mutation_type: "move",
      mutation_value: payload.folderId,
    });
  }

  function moveToTrash(message: LocalMessage): void {
    if (!trashFolder.value) return;
    void enqueueAndRefresh({
      message_id: message.id,
      mutation_type: "move",
      mutation_value: trashFolder.value.id,
    });
  }

  async function bulkTrash(ids: string[]): Promise<void> {
    const trash = trashFolder.value;
    if (!trash) return;
    await Promise.all(
      ids.map((id) =>
        enqueueAndRefresh({
          message_id: id,
          mutation_type: "move",
          mutation_value: trash.id,
        }),
      ),
    );
  }

  async function bulkMarkRead(ids: string[]): Promise<void> {
    const unreadIds = ids.filter((id) => {
      const message = messages.value.find((m) => m.id === id);
      return message ? !message.is_read : false;
    });
    if (unreadIds.length === 0) return;
    await Promise.all(
      unreadIds.map((id) =>
        enqueueAndRefresh({ message_id: id, mutation_type: "read", mutation_value: true }),
      ),
    );
  }

  async function bulkMove(payload: { ids: string[]; folderId: string }): Promise<void> {
    await Promise.all(
      payload.ids.map((id) =>
        enqueueAndRefresh({
          message_id: id,
          mutation_type: "move",
          mutation_value: payload.folderId,
        }),
      ),
    );
  }

  return {
    trashFolder,
    toggleStar,
    toggleRead,
    moveSingle,
    moveToTrash,
    bulkTrash,
    bulkMarkRead,
    bulkMove,
  };
}
