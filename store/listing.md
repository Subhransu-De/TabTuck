# Chrome Web Store listing

Copy these values into the Developer Dashboard. The name, summary, and icon come from the uploaded package. The images are in this folder.

## Store listing tab

**Name** (from the manifest): TabTuck

**Summary** (from the manifest): Save, organize and restore tab groups in the same browser window.

**Description:**

```text
TabTuck saves the tabs you don't need right now and brings them back when you do, in the same browser window.

Save
• Save the current tab with Alt+C, or the tabs to its left or right from the right-click menu.
• Pinned tabs and tabs in browser tab groups are skipped.

Organize
• Keep saved links in collections and folders, with stars and locks.
• Search everything you saved, or view it grouped by site.
• Select tabs and move them to another collection or a new one. Shift-click selects a range.

Restore
• Open TabTuck with Alt+Q or the toolbar icon.
• Restore one link or a whole collection in the current window.
• Deleted tabs wait in the Bin for 30 days, or the time you choose, so you can restore them.

Move your data
• Import tabs from a list of links, or restore a TabTuck backup.
• Back up as JSON or export as text.

Light and dark themes. Shortcuts can be changed on the browser's extension shortcuts page.

Private by design: no account, no server, no analytics, and no ads. Everything stays in your browser's local storage, and TabTuck makes no network requests.

Source code: https://github.com/Subhransu-De/TabTuck
```

**Category:** Productivity → Workflow & Planning

**Language:** English

**Store icon (128×128):** `src/icons/128.png`

**Screenshots (1280×800):** `screenshot-1-recent.png`, `screenshot-2-collection.png`, `screenshot-3-dark.png`, `screenshot-4-folders.png`

**Small promo tile (440×280):** `promo-small-440x280.png`

**Marquee promo tile:** not needed.

**Official URL:** none

**Homepage URL:** https://github.com/Subhransu-De/TabTuck

**Support URL:** https://github.com/Subhransu-De/TabTuck/issues

**Mature content:** No

## Privacy tab

**Single purpose description:**

```text
TabTuck saves the browser tabs the user chooses, lets the user organize them, and restores them in the same window.
```

**Permission justifications:**

| Permission     | Justification                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`         | Reads the URL and title of the tabs the user chooses to save, closes them after saving, and opens them again when the user restores them. |
| `storage`      | Stores saved tabs, collections, folders, and settings on the device in chrome.storage.local.                                              |
| `contextMenus` | Adds right-click menu items to save the current tab, save the tabs to its left or right, and open the TabTuck list.                       |
| `favicon`      | Shows each saved site's icon from the browser's local favicon cache, so no request is made to an outside icon service.                    |

**Are you using remote code?** No, I am not using remote code.

**Data usage, what user data do you collect:** Web history (the URLs and titles of tabs the user saves). The data stays on the device and is never sent anywhere.

**Certifications:** tick all three.

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/Subhransu-De/TabTuck/blob/main/wiki/privacy.md

## Distribution tab

**Payments:** Free of charge

**Visibility:** Public

**Distribution:** All regions

## Test instructions tab

No account or test credentials are needed. Leave it empty.
