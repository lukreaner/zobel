<script lang="ts">
  import { formatFullTimestamp } from '#lib/ui/date-time.js';

  import { formatListTime } from './list-time.js';

  /** When a chat's last message arrived, shown in its row by the messenger look. */
  interface Props {
    timestamp: number;
  }

  let { timestamp }: Props = $props();
</script>

<time
  class="zobel-row-time"
  datetime={new Date(timestamp).toISOString()}
  title={formatFullTimestamp(timestamp)}>{formatListTime(timestamp)}</time
>
