/**
 * Responsive layout breakpoints shared by JavaScript and CSS.
 */
export const BREAKPOINTS = {
  wide: '(width >= 48rem)',
  // Zobel: touch screens get the split view from 37rem, so an unfolded foldable in portrait
  // (around 40–47rem wide) shows the chat next to the room list.
  touchWide: '(width >= 37rem) and (pointer: coarse)',
  // Zobel: the screen must be short too, not only the window. Android shrinks the window while the
  // keyboard is open, which made an unfolded foldable in portrait drop the split view.
  compactHeight:
    '(height < 30rem) and (device-height < 30rem) and (width >= 32rem) and (pointer: coarse)',
  sidePanels: '(width > 70.25rem)',
  settingsStack: '42rem',
  compactContent: '32rem',
} as const;
