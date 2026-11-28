import { afterNavigate } from '$app/navigation';

/**
 * Focuses the message search field when search was opened by a tap, also on narrow screens.
 *
 * Sable only focuses it in the wide layout, so on a phone opening search from the chat list
 * needs a second tap into the field before typing. The tap that opened search lets the keyboard
 * come up with the focus. Coming back to search, from a result or with the back gesture, leaves
 * the keyboard closed, and so does any later navigation while search is open, such as the query
 * moving into the address.
 */
export function focusSearchWhenOpened(field: () => HTMLInputElement | undefined): void {
  let arrived = false;
  afterNavigate((navigation) => {
    if (arrived) return;
    arrived = true;
    if (navigation.type !== 'link' && navigation.type !== 'goto') return;
    const input = field();
    if (input && document.activeElement !== input) input.focus();
  });
}
