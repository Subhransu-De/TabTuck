# TabTuck privacy policy

Last updated: 24 October 2026

TabTuck saves the browser tabs you choose and restores them later. Everything it saves stays in your browser, on your device. TabTuck has no account, no server, no analytics, no ads, and no tracking. It never sends your data anywhere, and nobody but you can see it.

## What TabTuck stores

TabTuck stores nothing about your tabs until you agree to the notice it shows before your first save. After that, it stores:

- **Saved tabs**: the address (URL) and title of each tab you save, and the time you saved it.
- **How you organize them**: collection names, folders and their icons, stars, locks, and whether a collection is folded closed.
- **The Bin**: tabs you delete, with the time you deleted them, so you can restore them or undo the delete. "How long it is kept" below says when they are erased.
- **Your options**: the theme, the other choices in Options, how long the Bin keeps tabs, and that you agreed to the notice.
- **Save records**: a count of your saved tabs and a copy of your options, so saving stays fast. When you have many saved tabs, a new save is first written as a small separate record, then merged into the main data and erased the next time anything changes.
- **The last error**: if something goes wrong, the text of the error message, so the toolbar badge and the TabTuck page can show it to you. TabTuck erases it the next time you open TabTuck.

That is the full list. TabTuck does not store the content of pages, your browsing history, or anything about tabs you did not save.

## When TabTuck reads your tabs

TabTuck reads the address and title of open tabs only when you ask it to save, with the toolbar page, the right-click menu, or a keyboard shortcut. It keeps only the tabs you chose. Pinned tabs and tabs in browser tab groups are skipped.

When you open TabTuck, it also looks at the addresses of the tabs in the current window to see if its own page is already open. It stores nothing from that check.

## Where it is stored

Everything is kept in your browser's storage for extensions (`chrome.storage.local`), in this browser profile on this device. The TabTuck page also keeps a copy of your light or dark theme in its own local storage, so it opens in the right colours. Nothing is synced through your browser account or copied to your other devices.

TabTuck makes no network requests of its own. It has no server, uploads nothing, and sends no analytics or crash reports. Site icons come from your browser's own icon cache, through the `favicon` permission, so showing them does not contact the site. The fonts are included in the extension.

## How long it is kept

- Saved tabs, collections, and options stay until you delete them or remove the extension.
- A tab you delete goes to the Bin. By default it stays there for 30 days. In Options you can choose any time from 1 hour to 1 year.
- TabTuck erases expired Bin tabs the next time it reads or writes its data, which happens when you open TabTuck or change anything in it. So a tab can stay a little past its time if you do not use TabTuck for a while.
- The Bin holds at most 10,000 tabs. Past that, TabTuck erases older deletes to make room. Your latest delete is always kept.
- Restoring a tab from the Bin takes it out of the Bin. Opening a saved tab removes it from TabTuck, unless its collection is locked, "Keep a tab in TabTuck after opening it" is on, or you Ctrl-click it to keep a copy.

## Who can see it

Only you. TabTuck does not sell, share, or transfer your data, and uses it only to save, organize, and restore your tabs. The developer has no way to see what you save.

Your data leaves TabTuck only when you do it yourself:

- When you **copy** links, TabTuck puts them on your clipboard.
- When you **export**, TabTuck saves a file on your device with your saved tabs and collections. Exports do not include the Bin or your options.
- When you **import**, TabTuck reads only the file or text you give it.
- When you **open** saved tabs, your browser loads those pages, as it does for any link you click.

## How to delete it

- Delete single tabs or whole collections in TabTuck. They wait in the Bin until their time is up, then TabTuck erases them.
- To erase them now, erase them in the Bin or empty the Bin.
- Remove the extension from your browser to delete everything it stored, at once and for good.

## Chrome Web Store Limited Use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes

If TabTuck ever changes how it handles your data, this page and the extension will say so before the change takes effect.

## Contact

Ask questions or report a problem on the [TabTuck issues page](https://github.com/Subhransu-De/TabTuck/issues).
