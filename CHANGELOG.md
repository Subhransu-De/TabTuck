# Changelog

All notable changes to TabTuck are documented in this file.

Pull requests add their user-visible changes under Unreleased. The Release workflow moves them into a dated, versioned section and uses that section as the GitHub release notes.

## Unreleased

### Added

- A Bin for deleted tabs. Tabs stay there for 30 days, or for a time from 1 hour to 1 year chosen in Options, and can be restored to their collection or erased. The Bin holds up to 10,000 tabs and drops the oldest deletes first. ([#14](https://github.com/Subhransu-De/TabTuck/pull/14))
- Restore all has a menu with Restore and keep saved. ([#15](https://github.com/Subhransu-De/TabTuck/pull/15))
- The Bin shows the time left before each tab is erased, and Options says what a shorter bin time will erase before it is saved. ([#15](https://github.com/Subhransu-De/TabTuck/pull/15))

### Changed

- The manager page is rebuilt with React and shadcn/ui. Every earlier feature is kept. ([#14](https://github.com/Subhransu-De/TabTuck/pull/14))
- The manager is restyled as nested trays with a neutral accent, Inter and JetBrains Mono fonts, and larger text. ([#15](https://github.com/Subhransu-De/TabTuck/pull/15))
- Text in the manager is 15px Inter on a 22px line, one size up from 14px, and body text no longer has negative letter spacing.
- Import and Export are separate tabs, and Import has a file picker. ([#15](https://github.com/Subhransu-De/TabTuck/pull/15))
- The privacy policy is rewritten in plain words and covers the Bin. ([#14](https://github.com/Subhransu-De/TabTuck/pull/14))
- Releases start from a manual workflow on `main` that picks the next version, publishes the GitHub release from this changelog, and then submits the package to the Chrome Web Store.

### Fixed

- Text without its own size, such as plain buttons and the data notice, showed in the browser's default 12px font instead of Inter.
- Quick clicks on tab titles in one place restore one tab per click again. Before, clicks within half a second of each other were ignored. ([#15](https://github.com/Subhransu-De/TabTuck/pull/15))

## [1.1.0] - 2026-10-26

First Chrome Web Store release.

### Added

- Save the current tab with `Alt+C` or the right-click menu, which can also save all tabs to its left or right. Pinned tabs and tabs in browser groups are skipped.
- A manager page with three linked columns: the library (Recent, All tabs, Starred, collections and folders), the sites or save times of the selection, and the tabs. Open it with `Alt+Q`.
- Collections, folders with chosen icons, stars, locks, search and a view grouped by site.
- Select tabs and press Move to send them to another collection or a new one. Shift-click selects a range.
- Restore single tabs or whole collections in the same window, and copy links as a Markdown list.
- Import tabs from a list of links and export saved tabs as text.
- Delete with Undo.
- Light and dark themes that follow the system until you pick one. Fonts are bundled, so the page makes no font requests.
- A first-use notice that says what is saved and that it stays on the device. Nothing is saved until you agree.
- Fast saving, scrolling and search with libraries of tens of thousands of tabs.
