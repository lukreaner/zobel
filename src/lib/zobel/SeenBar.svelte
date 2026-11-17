<!--
  The "Seen" button below a timeline whose read receipts are sent by hand. It shows once
  the reader has had unread messages on screen, and sends the receipt the timeline kept back.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';

  import { useCoreClient } from '#lib/core/context.js';
  import { i18n } from '#lib/i18n.js';
  import Button from '#lib/ui/primitives/Button.svelte';
  import { toasts } from '#lib/ui/toasts.svelte.js';

  import type { HeldReadReceipt } from './manual-read-receipts.svelte.js';

  interface Props {
    /** Whether this chat's read receipts wait for the reader. */
    manual: boolean;
    receipt: HeldReadReceipt;
    roomId?: string;
    threadRootId?: string | null;
    /** Whether the chat counts as unread. A thread is asked about separately. */
    unread: boolean;
    onSeen: (eventId: string) => Promise<void>;
  }

  let { manual, receipt, roomId, threadRootId = null, unread, onSeen }: Props = $props();
  const core = useCoreClient();

  let threadUnread = $state(false);

  async function threadHasUnread(room: string, root: string): Promise<boolean> {
    try {
      const read = await core.rpc.timeline.unreadDiagnostics({
        room_id: room,
        thread_roots: [root],
      });
      const thread = read.threads.find((entry) => entry.root_event_id === root);
      return thread === undefined || thread.unread > 0;
    } catch (error) {
      // Better a button too many than a thread that can never be marked as read.
      console.debug('[zobel] the read state of the thread is unknown', error);
      return true;
    }
  }

  $effect(() => {
    const root = threadRootId;
    if (!manual || !roomId || root === null || receipt.eventId === null) return;

    let current = true;
    void threadHasUnread(roomId, root).then((value) => {
      if (current) threadUnread = value;
    });
    return () => {
      current = false;
    };
  });

  let waiting = $derived(
    manual && receipt.eventId !== null && (threadRootId === null ? unread : threadUnread)
  );

  // Switched off while a receipt was waiting: it goes out now, as it would have without this.
  $effect(() => {
    if (manual || receipt.eventId === null) return;
    untrack(() => receipt.send(onSeen)).catch((error: unknown) => {
      console.warn('[zobel] sending the held read receipt failed', error);
    });
  });

  function confirm(): void {
    receipt.send(onSeen).catch((error: unknown) => {
      console.warn('[zobel] sending the read receipt failed', error);
      toasts.error(i18n.t('zobel.seenFailed'));
    });
  }
</script>

{#if waiting}
  <div class="seen-bar">
    <Button class="seen-button" loading={receipt.sending} onclick={confirm}>
      <ChecksIcon aria-hidden="true" />
      {i18n.t('zobel.seen')}
    </Button>
  </div>
{/if}

<style>
  .seen-bar {
    display: flex;
    flex: none;
    justify-content: center;
    padding: var(--space-100) var(--page-gutter);
  }

  .seen-bar :global(.seen-button) {
    border-radius: var(--radii-pill);
  }

  /* In this layout the composer below reaches up into the timeline by this much. */
  @media (--app-layout) {
    .seen-bar {
      padding-block-end: calc(var(--space-100) + var(--space-300));
    }
  }
</style>
