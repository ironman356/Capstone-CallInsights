# Action plan drag-and-drop verification

## Scope

Cards can move between workflow columns using drag-and-drop. Existing Back and
Forward buttons remain available, including for keyboard and touch users.
Changes use the existing strategy update API. Cards move only after a successful
save; no owner or deadline functionality is included.

## Setup

Start the API and web app as described in README.md. Open `/strategies`.
Record the original status of any card used for testing and restore it afterward.
Use disposable local demo data for failure testing.

## Repeatable browser checks

1. Drag a Proposed card onto Accepted. Confirm its column and both counts update.
2. Reload the page. Confirm the saved card remains in Accepted.
3. Click Back. Confirm the card returns to Proposed and the counts update.
4. Click Forward, then Back. Confirm both controls still save status changes.
5. Drag a card into an empty column. Confirm the empty column accepts the card.
6. Drag directly across multiple stages. Confirm the selected destination is saved.
7. Drop onto the original column or release outside the board. Confirm no status
   change occurs and drag highlighting clears.
8. During dragging, check the source-card fade and destination highlight.
9. Confirm Back is disabled in Proposed and Forward is disabled in Closed.
10. With the API stopped in a disposable local test session, attempt a move.
    Confirm an error appears, the card stays in its original stage, and controls
    become available again. Restart the API and retry successfully.
11. Restore all test cards to their original stages and reload to verify.

## Verification recorded during implementation

Passed in Chrome against the local API:

- Proposed to Accepted by dragging.
- Saved status retained after browser reload.
- Dragging an Accepted card into an empty In Progress column.
- Back button returned both tested cards to their original stages.
- No browser error logs during the checked board interactions.
- Production Vite build passed.

Not yet verified: deliberate API failure, keyboard-only interaction, native touch
 dragging, cancelled/same-column drops, and direct multi-stage drag. Back/Forward
remain available as an alternative to native browser dragging.

The repository-wide TypeScript check currently reports missing `field` and
`model-approaches` entries in AskCiPage's PAGE_GUIDES. That error predates this
feature and is outside its scope.
