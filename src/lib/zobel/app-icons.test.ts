// @vitest-environment happy-dom
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: vi.fn() }));
vi.mock('@tauri-apps/plugin-os', () => ({ type: vi.fn() }));
import { invoke, isTauri } from '@tauri-apps/api/core';
import { type as osType } from '@tauri-apps/plugin-os';
import AppIconSettings from '#lib/features/settings/AppIconSettings.svelte';

import {
  ZOBEL_APP_ICON_PREVIEWS,
  ZOBEL_APP_ICONS,
  zobelAppIconLabel,
  zobelAppIconsFirst,
} from './app-icons.js';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(osType).mockReturnValue('android');
  vi.mocked(invoke).mockImplementation((command) => {
    // The plugin lists the icons sorted by ID.
    if (command === 'plugin:app-icon|get_available_icons')
      return Promise.resolve(['pride', 'propeller', 'zobel_chat', 'zobel_night']);
    if (command === 'plugin:app-icon|get_current_icon') return Promise.resolve('zobel_night');
    return Promise.resolve(undefined);
  });
});

test('Zobel has eight icons, each with a preview and a name', () => {
  expect(ZOBEL_APP_ICONS).toHaveLength(8);
  for (const icon of ZOBEL_APP_ICONS) {
    expect(ZOBEL_APP_ICON_PREVIEWS[icon], icon).toBeTruthy();
    expect(zobelAppIconLabel(icon), icon).not.toMatch(/^zobel\./);
  }
  expect(zobelAppIconLabel('pride')).toBeUndefined();
});

test("Zobel's icons come first, in their own order", () => {
  expect(zobelAppIconsFirst(['cuba', 'zobel_pixel', 'pride', 'zobel_classic'])).toEqual([
    'zobel_classic',
    'zobel_pixel',
    'cuba',
    'pride',
  ]);
});

test("the app icon picker offers Zobel's icons after the default, with pictures and names", async () => {
  render(AppIconSettings);
  const trigger = await screen.findByRole('combobox', { name: 'App icon' });
  expect(trigger).toHaveTextContent('Zobel at night');

  await userEvent.setup().click(trigger);
  await vi.waitFor(() => {
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });
  const choices = screen.getAllByRole('option');
  expect(choices.map((choice) => choice.textContent.trim())).toEqual([
    'Default',
    'Zobel at night',
    'Speech bubble',
    'Pride',
    'Propeller',
  ]);
  expect(choices.every((choice) => choice.querySelector('.select-item-image') !== null)).toBe(true);

  await userEvent.setup().click(choices[2]);
  await vi.waitFor(() => {
    expect(invoke).toHaveBeenCalledWith('plugin:app-icon|set_icon', {
      request: { icon: 'zobel_chat' },
    });
  });
});
