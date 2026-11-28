<script lang="ts">
  import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
  import ChatsIcon from 'phosphor-svelte/lib/ChatsIcon';
  import CompassIcon from 'phosphor-svelte/lib/CompassIcon';
  import HashIcon from 'phosphor-svelte/lib/HashIcon';
  import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
  import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
  import type { Component } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  import type { RoomListItemView } from '#src/generated/protocol';
  import { i18n } from '#lib/i18n.js';
  import { roomPathParam, useRoomList } from '#lib/rooms/room-list.svelte.js';
  import { NO_UNREAD, type UnreadCount } from '#lib/rooms/unread.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';
  import { openFindOrJoin } from '#lib/ui/find-or-join-state.svelte.js';
  import ActionMenu from '#lib/ui/primitives/ActionMenu.svelte';
  import ActionMenuItem from '#lib/ui/primitives/ActionMenuItem.svelte';
  import ActionMenuSeparator from '#lib/ui/primitives/ActionMenuSeparator.svelte';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import UnreadBadge from '#lib/ui/primitives/UnreadBadge.svelte';

  /**
   * The messenger look's stand-in for Sable's bar of spaces: the list's title opens a menu of
   * every list (home, rooms, direct messages, each space), much as Beeper's "Inbox" does.
   */
  interface Props {
    /** The list's title; without it the menu names the list it finds itself. */
    title?: string;
    activeSpace?: RoomListItemView | null;
    /** Floats as a pill at the bottom of the list, within reach of a thumb. */
    floating?: boolean;
    onNavigate?: (href: string) => void;
  }

  let { title, activeSpace, floating = false, onNavigate }: Props = $props();

  const roomList = useRoomList();

  interface Entry {
    href: string;
    label: string;
    icon?: Component;
    space?: RoomListItemView;
    unread: UnreadCount;
    dm?: boolean;
  }

  function unreadOf(key: string): UnreadCount {
    return roomList.section(key)?.unread ?? NO_UNREAD;
  }

  let sections = $derived<Entry[]>([
    ...(preferences.showHome
      ? [
          {
            href: resolve('/(app)/home'),
            label: i18n.t('nav.home'),
            icon: HouseIcon,
            unread: unreadOf('home'),
          },
        ]
      : []),
    {
      href: resolve('/(app)/rooms'),
      label: i18n.t('nav.unspaced'),
      icon: HashIcon,
      unread: unreadOf('unspaced'),
    },
    {
      href: resolve('direct'),
      label: i18n.t('common.directMessages'),
      icon: ChatsIcon,
      unread: unreadOf('direct'),
      dm: true,
    },
  ]);

  let spaces = $derived.by<Entry[]>(() => {
    const joined = roomList.rooms.filter(
      (room) => room.room_kind === 'space' && room.state === 'joined' && !room.is_tombstoned
    );
    const children = new Set(
      joined.flatMap((space) => space.space_children.map((child) => child.room_id))
    );
    return joined
      .filter((space) => !children.has(space.room_id))
      .map((space) => ({
        href: resolve('/(app)/space/[spaceId]', {
          spaceId: roomPathParam(space, roomList.rooms),
        }),
        label: space.name ?? space.display_name,
        space,
        unread: unreadOf(space.room_id),
      }));
  });

  let current = $derived(
    [...sections, ...spaces].find(
      (entry) => page.url.pathname === entry.href || page.url.pathname.startsWith(`${entry.href}/`)
    )
  );
  let CurrentIcon = $derived(current?.icon);
  let shownTitle = $derived(title ?? current?.label ?? i18n.t('zobel.sections'));
  /** Message search, within the space when a space's list is open, as the list's own entry does. */
  let searchHref = $derived.by(() => {
    const space = current?.space;
    const search = resolve('/(app)/search');
    if (!space) return search;
    const label = space.canonical_alias ?? space.name ?? space.room_id;
    const scope = label.includes(' ') ? `"${label}"` : label;
    return `${search}?q=${encodeURIComponent(`space:${scope} `)}&space=${encodeURIComponent(space.room_id)}`;
  });
  let shownSpace = $derived(activeSpace === undefined ? (current?.space ?? null) : activeSpace);

  const createEntries = [
    { href: resolve('create-room'), label: 'common.createRoom', icon: PlusIcon },
    { href: resolve('create-space'), label: 'common.createSpace', icon: HouseIcon },
    { href: null, label: 'nav.findOrJoin', icon: LinkIcon },
    { href: resolve('explore'), label: 'nav.explore', icon: CompassIcon },
  ] as const;

  function navigate(href: string): void {
    if (onNavigate) onNavigate(href);
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- every href here is built with resolve()
    else void goto(href);
  }
</script>

{#snippet entryItem(entry: Entry)}
  <ActionMenuItem
    class="zobel-section-item"
    checked={entry === current}
    kind="radio"
    onSelect={() => {
      navigate(entry.href);
    }}
  >
    {#if entry.space}
      <Avatar
        id={entry.space.room_id}
        src={entry.space.display_avatar_url}
        name={entry.label}
        size="small"
      />
    {:else if entry.icon}
      <entry.icon />
    {/if}
    <span class="zobel-section-label"><bdi>{entry.label}</bdi></span>
    <UnreadBadge counts={entry.unread} dm={entry.dm} />
  </ActionMenuItem>
{/snippet}

{#snippet menu()}
  <ActionMenu
    label={i18n.t('zobel.sectionMenu')}
    side={floating ? 'top' : 'bottom'}
    align={floating ? 'center' : 'start'}
  >
    {#snippet trigger({ props })}
      <button
        {...props}
        type="button"
        class={['zobel-section-switcher selection-open', { floating }]}
      >
        {#if shownSpace}
          <Avatar
            id={shownSpace.room_id}
            src={shownSpace.display_avatar_url}
            name={shownTitle}
            size="small"
          />
        {:else if CurrentIcon}
          <CurrentIcon class="zobel-section-icon" />
        {/if}
        <span class="zobel-section-title">{shownTitle}</span>
        <CaretDownIcon class="zobel-section-caret" />
      </button>
    {/snippet}
    {#each sections as entry (entry.href)}
      {@render entryItem(entry)}
    {/each}
    {#if spaces.length > 0}
      <ActionMenuSeparator />
      {#each spaces as entry (entry.href)}
        {@render entryItem(entry)}
      {/each}
    {/if}
    <ActionMenuSeparator />
    {#each createEntries as entry (entry.label)}
      <ActionMenuItem
        onSelect={() => {
          if (entry.href === null) openFindOrJoin();
          else navigate(entry.href);
        }}
      >
        <entry.icon />
        {i18n.t(entry.label)}
      </ActionMenuItem>
    {/each}
  </ActionMenu>
{/snippet}

{#if floating}
  <div class="zobel-floating-bar">
    {@render menu()}
    <!-- eslint-disable svelte/no-navigation-without-resolve -- searchHref is built with resolve() -->
    <a
      class="zobel-floating-search selection-open"
      href={searchHref}
      aria-label={i18n.t('nav.messageSearch')}
      draggable="false"
      onclick={() => onNavigate?.(searchHref)}
    >
      <MagnifyingGlassIcon />
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </div>
{:else}
  {@render menu()}
{/if}

<style>
  .zobel-section-switcher {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--radius-pill);
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    gap: var(--space-200);
    margin-inline-start: calc(-1 * var(--space-200));
    max-width: 100%;
    min-height: 2.5rem;
    padding: 0 var(--space-300) 0 var(--space-200);
  }

  .zobel-floating-bar {
    align-items: center;
    bottom: var(--space-400);
    display: flex;
    gap: var(--space-200);
    inset-inline: 0;
    margin-inline: auto;
    max-width: calc(100% - 2 * var(--space-400));
    pointer-events: none;
    position: absolute;
    width: fit-content;
    z-index: 2;
  }

  .zobel-section-switcher.floating,
  .zobel-floating-search {
    background: var(--surface-container);
    border: var(--border-width) solid var(--surface-container-line);
    box-shadow: 0 var(--space-100) var(--space-400) rgb(0 0 0 / 30%);
    min-height: var(--space-800);
    pointer-events: auto;
  }

  .zobel-section-switcher.floating {
    font-size: var(--font-size-body);
    font-weight: var(--font-weight-600);
    margin: 0;
    min-width: 0;
    padding-inline: var(--space-400);
  }

  .zobel-floating-search {
    align-items: center;
    border-radius: 50%;
    color: inherit;
    display: flex;
    flex: none;
    justify-content: center;
    width: var(--space-800);
  }

  .zobel-floating-search :global(svg) {
    height: var(--icon-size-small);
    width: var(--icon-size-small);
  }

  .zobel-floating-search:hover {
    background: var(--surface-container-hover);
  }

  .zobel-floating-search:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .zobel-section-switcher.floating:hover,
  .zobel-section-switcher.floating[data-state='open'] {
    background: var(--surface-container-hover);
  }

  .zobel-section-switcher:hover,
  .zobel-section-switcher[data-state='open'] {
    background: var(--bg-container-hover);
  }

  .zobel-section-switcher:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .zobel-section-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .zobel-section-switcher :global(.zobel-section-icon) {
    flex: none;
    height: var(--icon-size-small);
    width: var(--icon-size-small);
  }

  .zobel-section-switcher :global(.zobel-section-caret) {
    flex: none;
    height: 1rem;
    opacity: var(--opacity-p300);
    width: 1rem;
  }

  .zobel-section-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
