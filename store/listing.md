# Chrome Web Store listing

Copy these values into the Developer Dashboard. The name, summary, and icon come from the uploaded package. The images are in this folder.

## Store listing tab

**Name** (from the manifest): TabTuck: Save Tabs for Later

**Summary** (from the manifest): A private tab manager: save tabs for later, sort them into collections, search them, and restore them in the same window.

The name and summary are what store search and result cards show first, so they carry the phrases people type: "save tabs for later" and "tab manager". They change only with a new package.

**Description:**

```text
TabTuck is a tab manager for people with too many tabs open. Save tabs for later in one click, close them to free up memory, and restore them when you need them, in the same browser window.

Save tabs
• Save the current tab with Alt+C, or right-click to save every tab to its left or right.
• Saved tabs close, and you stay on the next tab.
• Pinned tabs and tabs in browser tab groups are left alone.

Organize saved tabs
• Sort links into collections and folders, with stars and locks.
• Search everything you saved, or see it grouped by site.
• Select tabs and move them to another collection or a new one. Shift-click selects a range.

Restore tabs
• Open TabTuck with Alt+Q or the toolbar icon.
• Restore one link or a whole collection in the current window, or restore it and keep it saved.
• Undo a delete you didn't mean to make. Deleted tabs also wait in the Bin for 30 days, or the time you choose.

Import and export
• Import a list of links, one per line. Lines written as "URL | title" keep their titles, and a blank line starts a new collection, so a OneTab export comes in as it is.
• Back up everything as JSON, export your tabs as text, or copy links as a Markdown list.

Private by design
No account, no server, no analytics, and no ads. Everything stays in your browser's local storage, and TabTuck makes no network requests.

Works in Chrome and any other Chromium browser, such as Edge, Brave and Helium. Light and dark themes. Shortcuts can be changed on the browser's extension shortcuts page.

Source code: https://github.com/Subhransu-De/TabTuck
```

**Category:** Productivity → Workflow & Planning

**Language:** English

**Store icon (128×128):** `src/icons/128.png`

**Screenshots (1280×800):** `screenshot-1-recent.png`, `screenshot-2-collection.png`, `screenshot-3-dark.png`, `screenshot-4-folders.png`, `screenshot-5-bin.png`

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

| Permission     | Justification                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`         | Reads the URL and title of the tabs the user chooses to save, closes them after saving, and opens them again when the user restores them.                                         |
| `storage`      | Stores saved tabs, collections, folders, and settings on the device in chrome.storage.local.                                                                                      |
| `contextMenus` | Adds right-click menu items to save the current tab, save the tabs to its left or right, and open the TabTuck list.                                                               |
| `favicon`      | Shows each saved site's icon from the browser's local favicon cache, so no request is made to an outside icon service.                                                            |
| `activeTab`    | When the user clicks the TabTuck button, uses its shortcut or opens its right-click menu, lets TabTuck read the declared site name of the tab they were on, if they then save it. |
| `scripting`    | Reads the site name a saved page declares in its meta tags (og:site_name, application-name), so the list can show the site's real name.                                           |

**Are you using remote code?** No, I am not using remote code.

**Data usage, what user data do you collect:** Web history (the URLs and titles of tabs the user saves) and Website content (the site name a saved page declares in its meta tags). The data stays on the device and is never sent anywhere.

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
