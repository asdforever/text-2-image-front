# iToVideo canvas implementation plan

**Goal:** Match the local iToVideo canvas appearance and direct dragging interactions while keeping our image workflow.

**Architecture:** Keep CanvasStudio and its persisted graph. Scope the full-window shell to the active canvas tab and introduce a neutral dark stylesheet. Use React Flow's direct pane panning and Shift selection; retain existing image library drag/drop and save queue.

**Tech stack:** React, TypeScript, React Flow, Playwright.

**Scope:** User-approved reference is the local iToVideo frontend. Keep generated images, versions, filters, editing, grouping, export, and long-image composition. Do not call generation providers during verification.

## Implementation

- [x] Add a browser regression for direct left-button pane movement, saved viewport restoration, and the image drawer in full screen. Run it against the current implementation and confirm missing behavior.
- [x] Update CanvasStudio: remove hold-to-pan handlers, use a 1px node drag threshold and direct pane panning, default image drawer closed, concentrate image/arrangement/zoom controls in the bottom dock. Keep explicit viewport saves and node saves.
- [x] Update ProjectWorkbench: compact project name/back navigation and existing output tabs when canvas is active. Hide the global sidebar only on that active tab. Preserve mounted tabs.
- [x] Add reference-canvas.css: original #141414 stage, #171717 panels, white selection, floating bottom dock, right image drawer, neutral image/graph cards and inspector. Preserve graph dimensions and actual image colors.
- [x] Adapt obsolete interaction assertions to the intentionally changed direct-drag contract, keeping save, version, grouping, filters, and retry tests.
- [x] Run build and canvas browser suites; inspect desktop and narrow screenshots. Review changes and fix concrete findings before delivery.

## Verification

- Production build and TypeScript checks pass.
- 37 selected browser tests pass, covering canvas drag/drop, viewport/node persistence, fullscreen geometry, tab round trips, filters, version switching, grouping, recovery, and the homepage.
- Three unrelated generation workspace tests fail identically against an isolated HEAD checkout; excluded from the canvas validation rather than changing their behavior in this UI task.
- Live desktop and 390px screenshots inspected; zero horizontal overflow and no page errors in the live canvas verification.
- Review findings corrected: stable portal target across tab changes, explicit fullscreen positioning, fullscreen filter offset. Deferred filter fitting while hidden to prevent invalid viewport dimensions.

## Connection interaction follow-up

User request: match iToVideo's connection interactions as well.

- [x] Drag from the output circle onto an input circle or anywhere on another card. Support dragging from the input circle in reverse.
- [x] Render Bezier links with arrows, hover and selected highlights. Keep the existing generation provenance links.
- [x] Add adjacent plus buttons to choose existing upstream/downstream cards. Only calculate candidates while the menu is open and isolate its scrolling from canvas zoom.
- [x] Select a manual link and disconnect it. Reject duplicate, self and cyclic links, including cycles involving generation provenance.
- [x] Persist manual outgoing targets as `nodes[].connections` in the existing versioned layout JSON. Node moves, viewport saves and refresh retain them. Save conflicts use the existing retry/reload recovery.
- [x] Verify frontend build, canvas units, browser connections and backend API round trips. All verification uses mocked generation providers or in-memory repositories.

Manual connections express canvas arrangement. They do not rewrite frozen generation inputs or automatically submit generation. Existing plus menus connect existing cards; creating a new standalone generation node is outside this change.

Final checks: 31 selected canvas browser tests (including six connection scenarios), 17 relevant frontend unit tests, four workbench API tests and the production build pass. Both review findings are fixed and rechecked: menu scrolling stays in the list; closed menus do zero candidate validation.
