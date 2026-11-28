# Zobel Changelog

## 0.3.0 (2026-11-28)

### Features

* In the Messenger look, the menu for switching lists can float at the bottom of the screen together with message search, as in Beeper, where a thumb reaches it more easily (Settings → Appearance → List menu).

### Fixes

* The Messenger look works with themes that keep the room list's rows short, such as Win95, Mac OS 9, Cyber Noir and Cyberpunk 77; their rows no longer overlap.
* In the Messenger look, the list menu at the top shows the whole name of the list instead of a few letters, and the setting's description is a single short sentence.
* On Android, notifications from chats named after the person who wrote, such as bridged WhatsApp chats, no longer show the name and picture twice.
* "Seen" shows again in threads you have not read anything in yet.

Based on Sable 26.11.5, with the changes of Sable 26.11.5 ([Sable's changelog](../CHANGELOG.md)).

## 0.2.0 (2026-11-28)

### Features

* On Android, GIFs, stickers and images from keyboards such as Gboard can be inserted into the message field; they used to be greyed out.
* A new look, "Messenger" (Settings → Appearance → Look), arranges Zobel like Signal or Beeper: a menu of lists in place of the bar of spaces, larger chat rows with the last message and its time, and messages in bubbles with yours on the right in the accent colour. In chats with one other person their name and picture are left out.

### Fixes

* After going through several chats on an unfolded foldable and folding it shut, the back gesture now leads to the list of chats instead of through every chat seen before.
* Opening a chat no longer opens the keyboard on touch screens in the split view, such as an unfolded foldable. "Jump to the message field when opening a chat" (Settings → Composer) can set this to always or never.
* "Seen" now shows right away in a chat opened by tapping a notification on Android, instead of only after leaving the chat and opening it again.

Based on Sable 26.11.4.

## 0.1.1 (2026-11-28)

### Fixes

* On an unfolded foldable, the chat no longer fills the whole screen while the keyboard is open; it stays next to the room list.

Based on Sable 26.11.4.

## 0.1.0 (2026-11-27)

### Features

* Zobel has its own Android app. It installs next to Sable instead of replacing it, and testers get it through Firebase App Distribution.
* The app is called Zobel. Its source link, bug reports and update check lead to Zobel's GitHub repository, and Settings → About still says it is powered by Sable.
* An unfolded foldable in portrait, and other touch screens from about 600 pixels wide, now show the chat next to the room list instead of one at a time.
* Chats can be marked as read by hand. With "Mark chats as read by hand" on (Settings → Privacy), opening a chat no longer tells the others you have read it; a "Seen" button below the messages does. Each chat can differ from the setting in its own settings.

Based on Sable 26.11.4.
