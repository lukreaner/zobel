/**
 * The page side of Zobel's `ZobelKeyboardImages` on Android: a GIF or image inserted from a
 * keyboard such as Gboard arrives as the `zobel-keyboard-image` event and is pasted into the
 * focused field, where the message field stages it like any pasted image.
 */
export interface KeyboardImage {
  mime: string;
  name: string;
  /** The file, base64-encoded. */
  data: string;
}

export const KEYBOARD_IMAGE_EVENT = 'zobel-keyboard-image';

function isKeyboardImage(value: unknown): value is KeyboardImage {
  if (typeof value !== 'object' || value === null) return false;
  const { mime, name, data } = value as Record<string, unknown>;
  return (
    typeof mime === 'string' &&
    mime.startsWith('image/') &&
    typeof name === 'string' &&
    typeof data === 'string'
  );
}

export function keyboardImageFile(image: KeyboardImage): File {
  const binary = atob(image.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], image.name, { type: image.mime });
}

/** Pastes `file` into the focused editable element; false when nothing editable has focus. */
export function pasteIntoFocus(
  file: File,
  target: Element | null = document.activeElement
): boolean {
  if (!(target instanceof HTMLElement) || !target.isContentEditable) return false;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  target.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })
  );
  return true;
}

/** Starts listening; returns a function that stops it. */
export function listenForKeyboardImages(): () => void {
  const onImage = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isKeyboardImage(detail)) pasteIntoFocus(keyboardImageFile(detail));
  };
  window.addEventListener(KEYBOARD_IMAGE_EVENT, onImage);
  return () => {
    window.removeEventListener(KEYBOARD_IMAGE_EVENT, onImage);
  };
}
