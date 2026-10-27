# Live Incident Command AR

## Goal

Add a tablet-and-phone friendly AR-style demo mode that feels useful for call intelligence instead of decorative.

This implementation is designed for:

- Android tablets
- Android phones
- Chrome or Edge-class mobile browsers
- No headset required
- No iPad-specific dependencies

## What ships in the app

The `Live Incident Command` page includes a touch-first `AR Field Mode` with:

- `AR Issue Constellation`
  - Floating issue clusters placed over a tabletop or wall scene
  - Larger nodes represent more calls
  - Node color reflects pressure and sentiment trend
  - Tapping a node opens issue evidence context and strategy recommendation
- `AR Call Journey Replay`
  - A representative call is shown as a compact journey with opening, mid-call, and closing sentiment
  - Escalation risk is surfaced as a simple operational label
  - The selected call remains one tap away from full drilldown
- `Recommended Action`
  - The current issue cluster immediately maps to a suggested action-plan draft
  - KPI tags keep the business story anchored in measurable outcomes
- `Decision Hologram`
  - A selected issue projects one decision surface containing the proposed pilot, evidence volume, representative call, and a visible rollout guardrail.
  - It routes directly to the source call or Action Plans, so the spatial view closes the evidence-to-action loop instead of serving as visual decoration.

## Why this fits the product

- It matches the issue clustering theme already present in the repo.
- It is visually stronger than another dashboard card.
- It is easy to explain in business terms during a demo.
- It works on a tablet or phone without special hardware.
- It naturally links evidence calls to action plans.

## Why the Decision Hologram is useful

The hologram is a compact decision-support surface for a supervisor and leadership team gathered around a tablet. It does not claim that a model recommendation is certain. Instead, it keeps the four facts needed before an operational change together in the same view:

1. **What to test**: the action-plan draft.
2. **Why now**: the issue cluster and observed call volume.
3. **What to inspect**: the representative source call.
4. **What limits the claim**: a readiness label and an explicit pilot/control guardrail.

This is appropriate for AR because the tablet view is being used for a shared review and spatial comparison of issue clusters, not to replace a normal dashboard. AR decision-support research identifies spatial context and data-context associations as the relevant advantage, while trustworthy AI guidance calls for understandable evidence, sufficient confidence, and human oversight. The application therefore treats the hologram as a route to evidence and a measured pilot, never as an autonomous decision.

## Implementation approach

This is a `WebAR-lite` implementation, not a native ARCore app.

That means:

- Camera access is optional.
- If camera permission is granted, the scene uses the tablet camera as a live backdrop.
- If camera permission is denied, the constellation still renders in ambient tabletop mode.
- Interaction is built for touch, not mouse hover.

This choice keeps the feature:

- demo-friendly
- browser-based
- fast to ship inside the existing Vite app
- resilient across non-iPad tablets

## Core UI pieces

### 1. Issue constellation

- Fixed spatial anchors position the top issue clusters in the scene.
- Node size is derived from issue call volume.
- Node tone is derived from average sentiment shift.
- A selected node updates the evidence and action side panel.

### 2. Call journey replay

- Uses the representative call for the selected issue cluster.
- Shows opening, mid, and closing sentiment as a compact progression.
- Adds an escalation risk label so the replay has operational meaning.

### 3. Action route

- Uses the selected issue to generate or surface a strategy draft.
- Keeps the transition from “interesting signal” to “management action” explicit.

## Device guidance for the demo

Best setup:

1. Use an Android tablet in Chrome.
2. Open `Live Incident Command`.
3. Tap `Launch AR field mode`.
4. If permissions allow, tap `Enable rear camera`.
5. Point the tablet at a table or wall.
6. Tap the largest issue node.
7. Show the evidence call and route into the action board.

## Future upgrades

If you want to push this further after the demo:

- use device orientation for parallax depth
- add real plane detection through a native wrapper
- persist AR annotations by issue cluster
- support multi-user review mode for manager walkthroughs
- add animated transcript milestones inside the call journey replay
