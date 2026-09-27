# UI redesign spec (by GPT-6 Sol, 2026-09-27)

> Written against the single-file client. Since then the client was split into `public/js/*.js` + `public/css/game.css` (see ARCHITECTURE.md): the functions/IDs named below still exist, now in their module files (store: `45-state.js`/`80-ui.js`, minimap + HUD: `78-hud.js`, CSS: `public/css/game.css`, markup: `public/index.html`). Line-number links below are stale; search by name.


**Target:** [public/index.html](/home/botuser/camp-green-lake/public/index.html). Implement with the file’s existing HTML, CSS, Canvas2D, and JavaScript. Use the loaded Google Fonts and inline SVG; add no framework, build step, or image asset.

The current store is a vertical list built by `renderShop()` from eight `SHOP` entries. Its buttons purchase immediately. The minimap is a player-following, north-up 320 × 320 canvas displayed at 160 × 160 pixels on desktop and 104 × 104 on narrow screens. `updateHUD()` runs every 100 ms and `drawMap()` every 200 ms. Preserve those update budgets as the starting point. [Store and purchase code](/home/botuser/camp-green-lake/public/index.html:958), [map code](/home/botuser/camp-green-lake/public/index.html:1559), [update loop](/home/botuser/camp-green-lake/public/index.html:2233).

## 1. Visual direction

**Art direction:** Camp-issued equipment meets a sun-bleached roadside store. Use dusty canvas, dark stamped ink, worn orange paint, faded survey markings, and restrained brass highlights. The interface should feel carefully made and legible over the low-poly desert, without photorealistic textures or glossy game-menu effects.

### Tokens

Keep the existing `--canvas`, `--ink`, `--jump`, `--lizard`, `--water`, `--danger`, and `--leaf` names so existing styles continue to work. Refine and extend them:

| Token | Value | Use |
|---|---:|---|
| `--canvas` | `#F2E7CD` | Main paper surface |
| `--canvas-2` | `#DFCCA6` | Recessed panels |
| `--canvas-deep` | `#C5A979` | Borders and map sand |
| `--ink` | `#281D15` | Primary text |
| `--ink-soft` | `#654E38` | Secondary text |
| `--ink-muted` | `#786A56` | Disabled labels |
| `--jump` | `#D96529` | Primary action |
| `--jump-deep` | `#A9471F` | Pressed action |
| `--lizard` | `#D7BF43` | Hazard |
| `--water` | `#397FA5` | Water and focus |
| `--danger` | `#AD392B` | Damage and curfew |
| `--leaf` | `#587347` | Health and safe status |
| `--brass` | `#B48A3B` | Seeds and rewards |
| `--night-paper` | `#232A29` | Night map surface |
| `--night-ink` | `#EDE2C8` | Night map text |
| `--scrim` | `rgba(24,17,11,.72)` | Modal backdrop |

Typography uses the already loaded Big Shoulders Stencil Display for headings and figures, and Barlow Condensed for UI text. Desktop scale: display 64 px, screen heading 40 px, section heading 26 px, item heading 21 px, body 17 px/1.3, label 13 px/1.2. Phone scale: display 46 px, screen heading 32 px, section heading 23 px, body 16 px/1.3; never put critical information below 14 px. Use tabular numerals for counts, prices, timers, and percentages.

Spacing follows 4, 8, 12, 16, 24, and 32 px. Cards have 4 px corners; controls have 3 px corners; pills use 999 px. Main frames use a 2 px dark border and a 4 px offset shadow (`0 4px 0 rgba(40,29,21,.45)`). Interior dividers are 1 px `rgba(40,29,21,.2)` or a sparse dashed rule. Give panels a small CSS corner notch or two short “registration mark” strokes; avoid full-screen texture overlays. Motion: 120 ms button press, 180 ms panel entry, 240 ms purchase confirmation, using `cubic-bezier(.2,.8,.2,1)`. Animate `transform` and `opacity`; respect `prefers-reduced-motion`.

### Icon set and frames

Define one hidden inline SVG sprite with `<symbol>` elements, then reference icons with `<svg><use href="#icon-name"></use></svg>`. Use 24 × 24 view boxes, 2 px rounded strokes, `currentColor`, and silhouettes that remain distinct without color. Required icons: sunflower seed, shovel, long shovel, detector, canteen, sack, rope, onion, battery, heart, water drop, clock, quota flag, depth gauge, flashlight, compass north, player arrow, teammate, NPC, lizard, twister, police truck, Zeroni warning, ping, map pin, search flags, close, check, lock, and chevrons. Use a seed silhouette for currency, never a generic coin.

The store frame resembles a painted wood counter with a canvas catalog inset; item cards resemble stamped inventory tags. The minimap sits in a shallow metal survey frame. Dialogue is a pinned paper card. Blackjack retains its felt table, with the same type, button, and notification language as the rest of the UI. Achieve material cues with flat color, borders, sparse repeating CSS lines, and SVG marks; avoid `backdrop-filter`.

## 2. Wreck Room store

### Layout and markup

The store is a modal within the existing `#shop`. Desktop width is `min(920px, calc(100vw - 32px))`, maximum height `calc(100dvh - 32px)`. A two-column layout gives the catalog about 60% of the width and a detail/checkout panel about 40%. At 700 px and below, use one column: compact header, horizontally scrollable tabs, two-column item grid where it fits, and a detail panel that follows the grid. At 420 px and below, use a single item column. Keep the close button and balance visible while the catalog scrolls. Modal content scrolls internally and honors safe-area insets; the touch controls remain behind the modal.

Use this structure, preserving existing IDs relied upon by code:

```html
<div id="shop" class="overlay" hidden>
  <section class="shop-frame" role="dialog" aria-modal="true"
           aria-labelledby="shopTitle" aria-describedby="shopFlavor">
    <header class="shop-head">
      <div>
        <p class="eyebrow">Camp Green Lake · Supply counter</p>
        <h2 id="shopTitle">Wreck Room Store</h2>
        <p id="shopFlavor">Mr. Sir says a better shovel still owes him five feet.</p>
      </div>
      <div class="shop-head-actions">
        <div class="seedline" aria-label="Your sunflower seeds">
          <svg aria-hidden="true"><use href="#icon-seed"></use></svg>
          <span><strong id="shopSeeds">0</strong> seeds</span>
        </div>
        <button id="shopClose" class="ui-button ui-button--quiet"
                type="button" aria-label="Close store">Close</button>
      </div>
    </header>

    <div class="shop-body">
      <div class="shop-catalog">
        <div id="shopTabs" class="shop-tabs" role="tablist"
             aria-label="Supply categories"></div>
        <div id="shopList" class="shop-grid"></div>
      </div>
      <aside id="shopDetail" class="shop-detail" aria-live="polite">
        <div id="shopDetailContent"></div>
        <div id="shopConfirm" class="shop-confirm" hidden></div>
        <p id="shopFeedback" class="shop-feedback" role="status"></p>
      </aside>
    </div>
  </section>
</div>
```

Render each catalog item as a real button, not a clickable `div`:

```html
<button class="shop-item" type="button" data-item="spade"
        aria-pressed="false" aria-controls="shopDetail">
  <span class="shop-item__icon" aria-hidden="true">…SVG…</span>
  <span class="shop-item__copy">
    <strong>Sharpened spade</strong>
    <small>Digging · Deeper scoops</small>
  </span>
  <span class="shop-item__price">45 seeds</span>
  <span class="shop-item__state">Available</span>
</button>
```

The detail panel shows the selected item’s full existing description, price, current effect, resulting effect, and state. Use comparisons only where the code gives a reliable value: spade `0.088 → 0.15` scoop depth (label it “about 70% deeper”), long shovel `5 → 8 ft` maximum, canteen `100 → 160` base water capacity, sack `+3 finds`, rope `8 → 1.5 s` climb, detector `7 m` range. Level bonuses must be reflected in displayed totals where applicable. Onion shows current count and `45 s` protection; battery shows current charge and `→ 100%`. These values come from the `SHOP` descriptions and upgrade logic. [Items and purchase logic](/home/botuser/camp-green-lake/public/index.html:958), [capacity and depth helpers](/home/botuser/camp-green-lake/public/index.html:887), [sack capacity](/home/botuser/camp-green-lake/public/index.html:2061).

Categories are **All**, **Digging** (spade, long shovel, detector), **Survival** (canteen, rope), and **Supplies** (bigger sack, onion, batteries). Category labels are presentation metadata on `SHOP`; do not change item IDs or save format. One-time upgrades show **In use** after purchase because they apply immediately and have no equip toggle. Consumables show their count or charge. Do not imply an equipment system that does not exist.

Selecting an available item exposes a primary **Buy for N seeds** button. Activating it opens an inline confirmation area in `#shopConfirm`: item name, price, balance after purchase, **Confirm purchase**, **Cancel**. Recheck funds and owned status on confirmation. After success, use the existing `sfx.coin()`, animate the seed number once, briefly stamp **Issued**, update the relevant card/detail state, and announce the result in `#shopFeedback`. Keep `toast()` for the world-facing purchase message. If the player cannot afford it, keep the item selectable for inspection, show **Need N more seeds**, and disable only the purchase action. Owned upgrades show **Already issued**. At 100% battery, show **Battery full** and disable buying batteries to prevent a purchase with no benefit. If the current category has no eligible products under a future catalog change, show a short empty-state card and leave the tabs and close action usable.

### Input and behavior

Opening the store releases pointer lock as it does now, saves the previously focused element, selects the first item, and focuses that item. `Escape` closes confirmation first, then closes the store; the existing `F` close shortcut remains. On close, restore focus when its target still exists. Trap `Tab` inside the dialog. Arrow keys move through item cards in visual grid order; `Home`/`End` select first/last; `Enter` or Space selects and activates focused buttons; left/right arrows switch tabs when tab focus is active. Do not intercept keys while a confirmation button has focus. Touch targets are at least 44 × 44 px, and selecting an item on a phone scrolls its detail panel into view without moving the page behind the overlay.

Add gamepad support only while `shopOpen`: poll a connected gamepad at 10 Hz, apply a 0.25 stick dead zone and 180 ms repeat delay; D-pad/stick moves selection, A selects or confirms the focused action, B cancels confirmation or closes. Stop polling when the store closes. Keyboard and touch must work with no gamepad connected.

Refactor `renderShop()` so it derives card states from `S`, updates existing card nodes by item ID, and redraws only when the shop opens, selection/category changes, or a purchase completes. It must not rebuild the entire catalog on every balance update or lose focus. Keep purchases in one guarded function, `buyShopItem(id)`, called only after confirmation. `openShop()`, `closeShop()`, `renderShop()`, the `SHOP` entries, `#shop`, `#shopList`, `#shopSeeds`, and existing input handling are the integration points. [Current functions](/home/botuser/camp-green-lake/public/index.html:958), [keyboard order](/home/botuser/camp-green-lake/public/index.html:1021).

## 3. Minimap and field map

### Frame, orientation, and content

Retain the north-up orientation. World `-z` is north on the current canvas; `+z` draws down, and the current player arrow already rotates independently. Keep this convention so the map never spins while the player digs. Replace the plain box with a rounded-square survey frame: 176 px outer width on desktop, 120 px on phones, 2 px ink border, clipped 8 px map corners, a small **N** marker above the map, and a fixed north tick. Put an unobtrusive zoom label, such as **260 m across**, below the canvas. Keep the existing `#onlineList` in a collapsed roster beneath the map on desktop; it may remain hidden on phones. [Current map markup and sizing](/home/botuser/camp-green-lake/public/index.html:198), [map transforms](/home/botuser/camp-green-lake/public/index.html:1562).

Draw in this order:

1. **Base:** warm lake-bed sand, subtle pale contour dashes every 50 m, darker land beyond `EDGE`, a clear camp rectangle, fence outline, four tent blocks, Warden’s cabin, store, blackjack tent, and water truck area. Use small distinctive silhouettes and labels only when enough pixels are available.
2. **Ground marks:** visible holes as low-contrast pits; distinguish own and other players’ holes by outline, not large saturated discs. Cap visual radius to avoid covering icons at high zoom. Draw bags and heavy carried objects as small outlined shapes.
3. **Objectives:** when `S.revealed`, draw `SEARCH` as the existing red-flag perimeter with a translucent fill; never show it before reveal. Mark camp at all times. Show a KB tube objective only when the player has the tube, pointing toward the Warden; do not reveal the hidden tube’s world position.
4. **People:** player as a high-contrast orange directional arrow with an ink outline; remote players as colored circles with one or two name initials; NPCs as smaller cream diamonds. Use stable player colors derived from player ID, and keep color plus shape or label so information does not depend on color alone.
5. **Threats:** active police trucks with a red/blue roof mark, active twisters with a three-stroke spiral, and active Zeroni with a green warning diamond. Show lizards only within 25 m of the player and only as small yellow hazard triangles; the game has 48 lizards, so drawing every one across the map would create clutter and reveal distant threats. The map can read their existing `lizards` positions and modes. [Existing map entities](/home/botuser/camp-green-lake/public/index.html:1565), [lizard collection](/home/botuser/camp-green-lake/public/index.html:801).
6. **Pings:** the existing `PINGS` rings fade with their remaining lifetime. Keep their sender color. [Ping data](/home/botuser/camp-green-lake/public/index.html:2147).

Use three zoom levels expressed as full visible width: **130 m**, **260 m** (default, matching the present view), and **520 m**. Add `−` and `+` buttons to `#mapbox`; mouse wheel over the map may change zoom, but must not scroll the page. Mobile buttons may be placed immediately beneath the map and must meet the 44 px touch target. Update `wx()`, `wz()`, and `ws()` to use the selected half-width rather than fixed `MV=130`.

Camp, revealed search area, active pings, and remote friends get edge indicators when outside the visible square. Clamp a marker to the map’s inner boundary with 10 px padding; show an arrow toward the true position and, for camp or objective, rounded distance in metres. Resolve collisions by priority: active threat warning, objective, ping, camp, friend; collapse overlapping friends into `+N`. Do not place off-screen NPC or hole indicators.

Night mode changes the map base to dark charcoal-green with pale terrain and brighter objective outlines when `clockT() >= DAYMS`. Preserve color contrast for danger markers. It is a map treatment, not a broad dimming layer over the game.

### Legend and full map

Put a compact legend behind a **Legend** button below `#mapbox`: You, Friend, Camp, Objective, Ping, Threat. It is closed by default on phones. Add an optional full-screen **Field map** as a later implementation step, opened with **J**, which is unused in the current key handler; `M` already mutes audio and `G` already pings. The field map shares drawing code, starts zoomed to 520 m, shows a full legend and friend names, and closes with J or Escape. Do not let J open it when chat, the store, dialogue, blackjack, console, or a future pause menu is open. [Existing keys](/home/botuser/camp-green-lake/public/index.html:1021). The field map is useful because the phone minimap cannot carry labels and because the lake extends roughly 1,200 m in each axis; it should not become a prerequisite for navigating nearby camp tasks. [World bounds](/home/botuser/camp-green-lake/public/index.html:344).

### Performance

Cache terrain tint, boundary, camp buildings, and static map lines in one **1024 × 1024 offscreen canvas** representing the world bounds. Initialize once and invalidate only for a layout/theme change. Each map draw copies the needed world rectangle from that canvas, then draws dynamic holes and markers on the visible canvas. Use a normal detached `<canvas>` fallback if `OffscreenCanvas` is unavailable. Keep the existing 5 Hz minimap redraw, drawing the player and threats at that cadence; do not create or move DOM markers every frame. On phones, retain a 2× backing resolution at most, and reduce label count rather than increasing canvas size. Reuse arrays and paths where practical; avoid allocating one gradient or SVG per marker per draw.

## 4. HUD overhaul

Keep `#hud` and the existing value IDs so `updateHUD()` can continue writing to them. Reorganize them into four clusters:

| Position | Always visible | Contextual |
|---|---|---|
| Top left, compact “camper” strip | Name, level, health bar, water bar | Low-health/low-water labels |
| Top center, narrow objective strip | Team quota, clock, curfew countdown | Walk-back estimate when outside camp; night threat text |
| Top right | Minimap | Roster, legend, zoom |
| Bottom left, above touch stick | Seeds, sack capacity/value | Onion count/effect, flashlight charge while on or low, detector signal while active |
| Bottom center | Interaction prompt | Hole depth while digging/in a hole; climb/revive progress |
| Bottom right, above touch buttons | Current shovel/reach glyphs | Other equipped tools when relevant |

On screens below 700 px, top-left and top-center become two small stacked strips with maximum combined width that leaves the 120 px map clear. If they cannot fit side by side, the quota/clock strip moves beneath the health/water strip. Hide tool names behind icons plus accessible labels; never hide health, water, curfew, quota, or the action prompt. Leave a reserved lower-corner area for touch controls. Future proximity voice status can occupy a small slot beside the name; the planned Escape menu and tent interior screens can use the shared panel components.

Show the existing `#hurtFx` for damage, with a maximum 180 ms peak and 500 ms decay; do not add a full-screen blur. At health below 30%, pulse only the health outline once every 2 seconds. At water below 25%, color the water bar amber and show a short **Low water** label; below 10%, use danger red. Respect reduced motion. Curfew under one minute gets a clear warning icon and text, not color alone. [Existing health, water, and curfew logic](/home/botuser/camp-green-lake/public/index.html:1532).

Turn `#prompt` into a two-part interaction chip: a distinct `kbd` or **Use** control and one sentence of action text. Preserve the current trapped, cooperative, and nearby interaction precedence in `updateHUD()`. Only rebuild the prompt DOM when its action or wording changes; progress text may update at 10 Hz. Put a tiny static four-stroke reticle at the screen center while pointer-locked, with an orange active state when digging or a nearby interaction is available. Hide it during overlays and on touch devices.

Keep `#toasts` as a capped feed of four, but place it below the top strips on desktop and above touch controls on phones. Define success, reward, warning, and neutral variants with an icon and text. Repeated identical warnings within 2 seconds should refresh their timer rather than stack. Cap each toast to two lines; longer story text belongs in a dialogue or objective note. The existing `toast(msg, cls, ms)` API can map existing `good`, `gold`, and `bad` calls to the new variants. [Toast function](/home/botuser/camp-green-lake/public/index.html:889).

Keep world name tags and speech bubbles tied to the existing `makeLabel()`, `say()`, and `updateLabels()` functions. Use a compact ink-backed name chip with a colored player edge; NPC chips use cream. Speech bubbles should be no wider than 220 px on desktop or 180 px on phones, with an opaque paper fill and a visible tail. The current distance hiding and projection should remain; do not create new labels each frame. [Label logic](/home/botuser/camp-green-lake/public/index.html:675).

## 5. Other screens and component library

**Title (`#title`):** Make the headline a tall stamped camp sign. Keep the nickname field and **Start digging** as the primary focus. Replace the long introductory paragraph’s single block with a two-sentence premise and three small objective cards: **Dig**, **Sell**, **Be back by curfew**. Put the gold tube and curse as a short secondary note below. Keep `#lobby` visible near the start action. On phones, place the action above the controls list and collapse controls to the five essentials; the existing full list can sit behind **Show controls**. [Current title](/home/botuser/camp-green-lake/public/index.html:208).

**Dialogue (`#dlg`):** Style as a pinned canvas/paper exchange: speaker tab, body text, numbered response rows, and a quiet leave button. Preserve `showNode()`’s numbered options and first-option focus. Limit the panel to `min(680px, 100vw - 24px)` and `max-height: min(55dvh, 440px)`; scroll option rows inside it. On phones, anchor it above the safe-area bottom and touch controls, with at least 44 px option rows. [Dialogue builder](/home/botuser/camp-green-lake/public/index.html:1599).

**Blackjack (`#cards`):** Keep the felt, card layout, phase rules, and X-Ray’s dialogue. Refine the table rim to match dark wood/ink framing; put the seed balance and bet in a stable header so they do not jump between phases. Give the selected chip a stamped ring and text state, and make **Deal**, **Hit**, **Stand**, and **Double** use the shared button variants. Add a clear status line for **Betting**, **Your turn**, and **Result** driven by `renderBJ()`. Do not alter payouts or card logic. [Current table](/home/botuser/camp-green-lake/public/index.html:238), [render function](/home/botuser/camp-green-lake/public/index.html:1684).

**Knockout (`#ko`), win (`#win`), fired (`#fired`):** Use one outcome card layout: small event label, large title, event description, consequence line, and existing action if one exists. Knockout keeps its automatic recovery state and must not show a false button. Win emphasizes rainfall with a restrained blue accent and retains **Keep digging**. Fired uses a dark red accent and retains **Start a new run**. Keep the existing text IDs and transitions. [Current overlays](/home/botuser/camp-green-lake/public/index.html:285).

**Shared components:** `.ui-button` with primary, secondary, quiet, danger, and disabled variants; `.ui-panel`; `.ui-card`; `.ui-badge`; `.ui-meter`; `.ui-kbd`; `.ui-divider`; `.ui-icon`; `.ui-sr-only`. All actionable elements need visible `:focus-visible`, pressed and disabled states, and 44 px minimum touch height. Screen-reader status uses `role="status"` or the existing polite live region; decorative SVGs use `aria-hidden="true"`. Use ordinary opacity and solid fills over the 3D scene, with no animated `backdrop-filter`.

## 6. Additional suggestions, ranked

| Priority | Suggestion | Impact | Effort |
|---|---|---|---|
| 1 | Add a brief, persistent **next task** line near the quota strip: dig, sell, return, or inspect the revealed flags, derived from existing state. | High | Low |
| 2 | Add a one-time, three-step control hint on a player’s first run; retire hints as actions are used. | High | Medium |
| 3 | Add field-map access with J and an explicit phone map button. | High | Medium |
| 4 | Add a small sound/visual accessibility setting within the planned options menu: reduced UI motion and larger HUD text. | Medium | Medium |
| 5 | Add camp location labels on the expanded map, limited to the existing known buildings. | Medium | Low |
| 6 | Add a “last purchase” receipt in the store during the current visit. | Low | Low |

## 7. Implementation plan

Each step should be independently mergeable within the single HTML file. Keep existing game logic, IDs, and state fields working between steps.

| Order | Step and exact touch points | Acceptance checks |
|---|---|---|
| 1 | Add tokens, SVG sprite, and shared CSS components in `<style>` and near the opening body markup. Touch existing `.panel`, `.card`, `button`, focus, mobile, and reduced-motion rules. | Existing title, store, dialogue, blackjack, and outcome actions still work; 360 px viewport has no horizontal page overflow; keyboard focus is visible. |
| 2 | Replace the inner `#shop` markup; extend `SHOP` with category/icon metadata; revise `openShop()`, `closeShop()`, `renderShop()` and purchase handling; add `#shopTabs`, `#shopDetail`, `#shopConfirm`, `#shopFeedback`. Touch the shop branch in the `keydown` handler for modal navigation. | All eight items display the correct state and price. Buying deducts once after confirmation; unaffordable and owned items cannot charge; full batteries cannot be repurchased; Escape and F close correctly; focus survives list updates. |
| 3 | Restyle `#mapbox` and `#minimap`; revise `MV`, `wx()`, `wz()`, `ws()`, `drawMap()`; add static map cache, zoom controls, and legend. | At default zoom the visible width is still 260 m; camp and revealed search area have correct positions; north stays up; moving player stays centered; dynamic markers update at about 5 Hz; phone map remains legible. |
| 4 | Add edge indicators, night palette, nearby lizard symbols, initials, and collision rules inside the map drawing helpers and `drawMap()`. | Distant hidden objectives remain hidden; off-screen camp/search/friends point the right way; indicators do not cover the player; night warnings remain readable. |
| 5 | Reorganize `#stats`, `#prompt`, `#toasts`, and `#keys`; revise `updateHUD()` and `toast()`; add static crosshair markup/CSS. Touch `.tag` and `.bubble` styles, leaving `updateLabels()` projection behavior intact. | Health/water/quota/curfew remain visible at 360 px; conditional values appear only in their stated contexts; touch buttons and prompts do not overlap; damage and low-water warnings work without continuous DOM construction. |
| 6 | Restyle `#title`, `#dlg`, `#cards`, `#ko`, `#win`, and `#fired`; revise `showNode()` and `renderBJ()` only where status/markup needs updating. | Dialogue numbered choices and blackjack keys still work; blackjack payouts and overlay actions are unchanged; every modal can be operated by keyboard and touch. |
| 7 | Add optional `#fieldMap` using the map renderer and J handling in the existing `keydown` branch; add a phone map button. | J opens only during normal play; Escape/J closes; M still mutes and G still pings; store/dialogue/blackjack and the future pause menu retain input priority. |

For final review, inspect desktop and 360 × 800 phone layouts in daylight and at night, with an empty sack, low water, imminent curfew, an unaffordable store item, an owned upgrade, a revealed search area, and at least one remote player. Compare frame pacing before and after the minimap change on a weak device; the redesign should preserve the present 10 Hz HUD and 5 Hz map cadence rather than add per-frame UI work.