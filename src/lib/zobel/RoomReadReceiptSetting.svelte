<!-- The row in a chat's settings that sets it apart from "Mark chats as read by hand". -->
<script lang="ts">
  import { i18n } from '#lib/i18n.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';
  import Select from '#lib/ui/primitives/Select.svelte';
  import SettingsRow from '#lib/ui/primitives/SettingsRow.svelte';

  import {
    roomManualReadReceipts,
    setRoomManualReadReceipts,
  } from './manual-read-receipts.svelte.js';

  const DEFAULT = 'default';
  const ON = 'on';
  const OFF = 'off';

  interface Props {
    roomId: string | null;
  }

  let { roomId }: Props = $props();

  let choice = $derived(roomManualReadReceipts(roomId));
  let value = $derived(choice === null ? DEFAULT : choice ? ON : OFF);
  let options = $derived([
    {
      value: DEFAULT,
      label: i18n.t('room.appearanceIconDefault', {
        mode: i18n.t(
          preferences.manualReadReceipts ? 'zobel.roomReadReceiptsOn' : 'zobel.roomReadReceiptsOff'
        ),
      }),
    },
    { value: ON, label: i18n.t('zobel.roomReadReceiptsOn') },
    { value: OFF, label: i18n.t('zobel.roomReadReceiptsOff') },
  ]);

  function select(next: string): void {
    if (roomId) setRoomManualReadReceipts(roomId, next === DEFAULT ? null : next === ON);
  }
</script>

<SettingsRow
  title={i18n.t('zobel.roomReadReceiptsTitle')}
  description={i18n.t('zobel.roomReadReceiptsHint')}
>
  <Select
    {value}
    aria-label={i18n.t('zobel.roomReadReceiptsTitle')}
    items={options}
    onValueChange={select}
  />
</SettingsRow>
