import ChatsCircleIcon from 'phosphor-svelte/lib/ChatsCircleIcon';
import LockSimpleIcon from 'phosphor-svelte/lib/LockSimpleIcon';
import MoonIcon from 'phosphor-svelte/lib/MoonIcon';
import PaintBrushIcon from 'phosphor-svelte/lib/PaintBrushIcon';
import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
import { hasDeploymentTheme } from '#lib/deployment/theme.svelte.js';
import { chooseChatLook } from '#lib/zobel/chat-look.svelte.js';
import type { SettingsCategory } from '../registry';

export const appearanceCategory: SettingsCategory = {
  id: 'appearance',
  name: 'settings.appearanceTitle',
  icon: PaintBrushIcon,
  sections: [
    { id: 'look', name: 'zobel.chatLookSection' },
    { id: 'themes', name: 'settings.groups.themes' },
    { id: 'font', name: 'settings.groups.font' },
    { id: 'room-header', name: 'settings.groups.roomHeader' },
  ],
  items: [
    {
      key: 'chatLook',
      section: 'look',
      icon: ChatsCircleIcon,
      name: 'zobel.chatLook',
      description: 'zobel.chatLookHint',
      terms: ['zobel.chatLookTerms'],
      type: 'select',
      options: [
        { value: 'sable', label: 'zobel.chatLookSable' },
        { value: 'messenger', label: 'zobel.chatLookMessenger' },
      ],
      onChange: chooseChatLook,
    },
    {
      key: 'theme',
      section: 'themes',
      icon: MoonIcon,
      name: 'settings.theme',
      terms: ['settings.terms.theme'],
      type: 'select',
      options: [
        { value: 'system', label: 'common.system' },
        { value: 'dark', label: 'common.dark' },
        { value: 'light', label: 'common.light' },
      ],
    },
    {
      key: 'deploymentTheme',
      supported: hasDeploymentTheme,
      section: 'themes',
      icon: PaintBrushIcon,
      name: 'settings.deploymentTheme',
      description: 'settings.deploymentThemeHint',
      type: 'boolean',
    },
    {
      key: 'saturation',
      section: 'themes',
      icon: PaletteIcon,
      name: 'settings.saturation',
      terms: ['settings.terms.saturation'],
      type: 'range',
      step: 0.05,
    },
    {
      key: 'showEncryptionStatusIcon',
      section: 'room-header',
      icon: LockSimpleIcon,
      name: 'settings.showEncryptionStatusIcon',
      type: 'boolean',
    },
  ],
};
