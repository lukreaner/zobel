<script lang="ts">
  import type { RoomTimeline } from '#lib/rooms/timeline.svelte.js';

  /**
   * Hands the "Seen" button the newest message on screen even while the window has no focus.
   *
   * Sable's `TimelineReadReceipt` only reads while the window is active, so it does not send
   * receipts for a window in the background. On Android a chat opened by tapping a
   * notification has no focus until the first touch, so "Seen" stayed away until the chat was
   * left and opened again: Sable also waits for the first new message to have been in view
   * with focus. Holding a receipt sends nothing, so with the newest messages on screen the
   * newest one is held at once.
   */
  interface Props {
    timeline: RoomTimeline;
    /** Whether the newest messages are on screen, with the view following new ones. */
    atLatest: boolean;
    enabled: boolean;
    onHold: (eventId: string) => Promise<void>;
  }

  let { timeline, atLatest, enabled, onHold }: Props = $props();

  /** The last event handed over; it is not handed over again once "Seen" has sent it. */
  let held: string | null = null;

  function newestEventId(): string | null {
    for (let index = timeline.items.length - 1; index >= 0; index -= 1) {
      const eventId = timeline.items[index].event_id;
      if (eventId) return eventId;
    }
    return null;
  }

  $effect(() => {
    if (!enabled || !atLatest) return;
    const eventId = newestEventId();
    if (eventId === null || eventId === held) return;
    held = eventId;
    void onHold(eventId);
  });
</script>
