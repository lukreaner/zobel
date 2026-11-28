<script lang="ts">
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
  import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
  import type { RoomListItemView } from '#src/generated/protocol';
  import { i18n } from '#lib/i18n.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';

  /**
   * Zobel: in front of a chat's message preview, whether your own last message is still being
   * sent (a clock) or has been sent (a tick), with the setting `chatListStatus`.
   */
  interface Props {
    room?: RoomListItemView;
  }

  let { room }: Props = $props();

  let status = $derived.by(() => {
    const event = room?.latest_event;
    if (!preferences.chatListStatus || !event?.own) return null;
    return event.sending ? 'sending' : 'sent';
  });
</script>

{#if status}
  <span
    class="zobel-message-status"
    data-status={status}
    role="img"
    aria-label={i18n.t(status === 'sending' ? 'zobel.messageSending' : 'zobel.messageSent')}
  >
    {#if status === 'sending'}<ClockIcon size="1em" />{:else}<CheckIcon
        size="1em"
        weight="bold"
      />{/if}
  </span>
{/if}

<style>
  .zobel-message-status {
    display: inline-flex;
    margin-inline-end: 0.25em;
    vertical-align: -0.125em;
  }

  .zobel-message-status[data-status='sending'] {
    opacity: var(--opacity-p300, 0.6);
  }
</style>
