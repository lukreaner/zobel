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

  import type { TimelineItemView } from '#src/generated/protocol';

  import type { HeldReadReceipt } from './manual-read-receipts.svelte.js';

  interface Props {
    /** Whether this chat's read receipts wait for the reader. */
    manual: boolean;
    receipt: HeldReadReceipt;
    roomId?: string;
    threadRootId?: string | null;
    /** Whether the chat counts as unread. A thread is asked about separately. */
    unread: boolean;
    /** The messages on screen; a thread is judged by its newest one. */
    items?: readonly TimelineItemView[];
    onSeen: (eventId: string) => Promise<void>;
  }

  let {
    manual,
    receipt,
    roomId,
    threadRootId = null,
    unread,
    items = [],
    onSeen,
  }: Props = $props();
  const core = useCoreClient();

  let threadUnread = $state(false);

  interface Newest {
    timestamp: number;
    own: boolean;
  }

  function newestOf(list: readonly TimelineItemView[]): Newest | null {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const item = list[index];
      if (item.event_id) return { timestamp: item.timestamp, own: item.is_own };
    }
    return null;
  }

  let newestTimestamp = $derived(newestOf(items)?.timestamp ?? null);
  let newestOwn = $derived(newestOf(items)?.own ?? false);

  async function threadHasUnread(
    room: string,
    root: string,
    newest: Newest | null
  ): Promise<boolean> {
    try {
      const read = await core.rpc.timeline.unreadDiagnostics({
        room_id: room,
        thread_roots: [root],
      });
      const thread = read.threads.find((entry) => entry.root_event_id === root);
      if (thread?.receipt_event_id) return thread.unread > 0;
      if (thread !== undefined && thread.unread > 0) return true;
      // Never read in this thread: Sable's core counts nothing then, and Sable goes by the
      // read receipt in the main chat, which covers everything sent before it.
      if (newest === null) return true;
      if (newest.own) return false;
      return newest.timestamp > (read.unthreaded_receipt_timestamp ?? 0);
    } catch (error) {
      // Better a button too many than a thread that can never be marked as read.
      console.debug('[zobel] the read state of the thread is unknown', error);
      return true;
    }
  }

  $effect(() => {
    const root = threadRootId;
    if (!manual || !roomId || root === null || receipt.eventId === null) return;
    const newest = newestTimestamp === null ? null : { timestamp: newestTimestamp, own: newestOwn };

    let current = true;
    void threadHasUnread(roomId, root, newest).then((value) => {
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
