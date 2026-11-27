/**
 * Zobel is a fork of Sable. Upstream writes most interface text with `{{appName}}`,
 * but a few strings spell "Sable" out. Rewriting them when a language loads, instead
 * of editing the locale files, keeps those files identical to upstream so its
 * translation updates merge without conflicts.
 */

/** Strings that name the app the user is running. */
export const APP_NAME_KEYS: readonly string[] = [
  'auth.serverSignInIntro',
  'bugReport.descriptionPage',
  'bugReport.openOnForge',
  'home.resourcesLabel',
  'qrLogin.chooseLogin',
  'room.appearanceHideBridgesHint',
  'room.moderationProtectionUnknown',
  'settings.callGlobalShortcutsHint',
  'settings.deploymentThemeHint',
  'settings.logoutServer',
  'settings.logoutServerFailed',
  'settings.matrixLinkHandler',
  'settings.matrixLinkHandlerAction',
  'settings.searchPeerFindHint',
  'settings.searchPeerNoAnswer',
  'settings.searchPeerNoAnswerRetrying',
  'settings.searchPeerPausedBackground',
];

/** Strings about the Sable project, its services, its donors or its themes: these stay. */
export const UPSTREAM_NAME_KEYS: readonly string[] = [
  'common.supportSable',
  'settings.aboutPoweredBy',
  'settings.clientEmbedsHint',
  'settings.customThemesErrorHeader',
  'settings.encryptedClientEmbedsHint',
  'settings.notificationRulesCleanupHint',
  'settings.supporterBegTitle',
  'settings.supporterThanksTitle',
  'settings.supporterWaiting',
  'settings.telemetryBannerSablePolicy',
  'settings.themeCatalogTweaksHint',
  'settings.themeSableDefault',
  'settings.useDearrowHint',
  'supporter.badgeDescription',
  'supporter.badgeDonate',
  'supporter.badgeDonorDescription',
  'supporter.badgeDonorHint',
  'supporter.badgeOwnDescription',
  'supporter.colors.custom',
  'supporter.colors.evil',
  'timeline.profileSupporter',
];

const UPSTREAM_NAME = 'Sable';

type Tree = Record<string, unknown>;

function isTree(value: unknown): value is Tree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns the bundle with "Sable" replaced by `{{appName}}` in the strings that name the app. */
export function useAppNameInLocale<T extends Tree>(bundle: T): T {
  const result: Tree = { ...bundle };
  for (const key of APP_NAME_KEYS) {
    const path = key.split('.');
    const leaf = path.pop();
    if (leaf === undefined) continue;

    let node: Tree | undefined = result;
    for (const part of path) {
      const child: unknown = node[part];
      if (!isTree(child)) {
        node = undefined;
        break;
      }
      const copy: Tree = { ...child };
      node[part] = copy;
      node = copy;
    }

    const text = node?.[leaf];
    if (node && typeof text === 'string') {
      node[leaf] = text.replaceAll(UPSTREAM_NAME, '{{appName}}');
    }
  }
  return result as T;
}
