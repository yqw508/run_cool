# Premium PNG Asset Refresh Plan

## Goal

Replace the current mixed procedural/rough visual assets with polished PNG assets across the character lobby, map selection, and runner gameplay. The first pass should prioritize visual stability and consistency over animation complexity.

## Current Context

- The game already supports separate character assets:
  - `assetUrl`: runner gameplay character image
  - `lobbyAssetUrl`: character lobby image
- The baby-brother character now proves the target direction:
  - runner: `src/assets/characters/baby-brother-run-back.png`
  - lobby: `src/assets/characters/lobby-baby-brother-v2.png`
- Procedural shapes still exist for obstacles, collectibles, map landmarks, HUD icons, and some background details.
- 3D/2.5D character limb animation is not the right fit for this project. The new direction is high-quality static PNGs with light squash/bob/scale effects only.

## Asset Rules

- Every playable character needs two final PNGs:
  - back-facing runner sprite for gameplay
  - front-facing lobby sprite for selection/lobby
- PNGs should be transparent, trimmed, and game-sized before commit.
- Target size:
  - characters: 512 px height source PNG, under 200 KB when practical
  - small props/icons: 128-256 px, under 80 KB when practical
  - background panels/landmarks: 512-1024 px depending on viewport use
- Keep generated source prompts and raw generated files out of the app bundle unless needed.
- Use consistent naming:
  - `character-id-run-back.png`
  - `lobby-character-id-v2.png`
  - `map-theme-landmark.png`
  - `obstacle-theme-kind.png`
  - `collectible-theme-kind.png`

## Game UI Design Rules

Use the installed `game-ui-design` skill for menu/HUD decisions before redesigning each screen.

Core rules for this game:

- Keep critical UI inside a 5% safe margin from screen edges.
- Runner HUD must not cover the center lane, the player, upcoming obstacles, or collectibles.
- During gameplay, show only information needed right now: score, collectible count, health, pause.
- Any text over gameplay must have a high-contrast outline, shadow, or backing panel.
- Touch controls and buttons should target at least 48x48 px at the game reference size.
- Do not communicate important state by color alone; pair color with icon shape or text.
- UI animations should be short and gentle, preferably under 300 ms, with no HUD shake.
- For mobile portrait, test readability while the road is moving, not only on static screenshots.

Screen-specific direction:

- Lobby page: playful and polished, but not cluttered. Character is the hero; buttons and stats support selection.
- Map selection page: cards should be visually distinct by theme and readable at a glance.
- Runner page: gameplay readability wins over decoration. PNG assets should enrich the scene without hiding hazards.

## Phase 1: Character Asset Baseline

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Generate front/back PNGs for all five characters | M | Baby-brother style approved | 10 character PNGs |
| Update `characters.ts` asset references | S | New PNGs | correct lobby/run mapping |
| Normalize in-game display sizes per character | S | New PNGs | no oversized/undersized characters |
| Remove or demote failed layered baby runner path | S | New mapping stable | simpler runner rendering |

Files:
- `src/game/characters.ts`
- `src/game/RunnerScene.ts`
- `src/assets/characters/*`

Manual checks:
- Each character is front-facing in lobby.
- Each character is back-facing or rear 3/4 in runner.
- All characters fit the lane, do not cover obstacles, and read clearly at mobile size.

## Phase 2: Lobby Page Refresh

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Replace procedural lobby character presentation with PNG-first layout | M | Phase 1 | cleaner character carousel/selection |
| Generate lobby environment PNG accents | M | visual direction approved | premium garden/playroom feel |
| Replace rough badges/buttons where useful with PNG UI elements | S | environment assets | more polished selection UI |
| Tune shadows, depth, and scale | S | integrated assets | cohesive lobby composition |

Candidate assets:
- soft playroom/garden background panel
- selection pedestal/platform
- character shadow blobs
- decorative toys/signage
- selected-character highlight
- PNG button set for start, next, back, and select actions

Manual checks:
- First screen clearly shows the selected character.
- Character cards/buttons remain readable and tappable.
- No nested-card or cluttered marketing feel.
- All interactive controls meet the 48x48 px touch target rule.

## Phase 3: Map Selection Page Refresh

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Generate theme map cards for campus, mall, zoo, amusement | M | theme list stable | four premium map thumbnails |
| Replace procedural landmark clusters with PNG thumbnails | M | map cards | more legible map selection |
| Generate theme-specific lock/selected/completed state accents if needed | S | map card layout | richer state feedback |
| Update map selection layout and sizing | S | assets integrated | mobile-safe map page |

Candidate assets:
- `map-campus-card.png`
- `map-mall-card.png`
- `map-zoo-card.png`
- `map-amusement-card.png`
- small theme badges and route markers
- selected-state frame and locked/completed variants if needed

Manual checks:
- Each map card is visually distinct.
- Selected map state is obvious.
- Text labels do not overlap art.
- Cards remain easy to compare on a small portrait screen.

## Phase 4: Runner Page Refresh

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Generate theme-specific road/background PNG layers | L | theme visual direction | polished runner scenery |
| Generate obstacles as PNGs per theme | M | obstacle list stable | consistent obstacle style |
| Generate collectibles as PNGs per theme | S | collectible list stable | clearer reward items |
| Replace procedural obstacle/collectible drawing with image factories | M | PNG assets | simpler, prettier gameplay objects |
| Tune sizing, collision body offsets, and shadows | M | image factories | fair gameplay hitboxes |
| Add fallback paths for missing textures | S | image factories | resilience during iteration |

Candidate runner assets:
- road texture or lane overlays
- campus: rail, cone, school cart, flower collectible
- mall: shopping cart, arch/gate, coin collectible
- zoo: wooden fence, leaf collectible
- amusement: small gate, balloon collectible
- general obstacle cue icons
- refreshed HUD frames/icons for score, health, collectibles, and pause

Manual checks:
- Obstacles are readable before collision.
- Collectibles are visible against each theme.
- Hitboxes still feel fair after visual replacement.
- Runner page keeps stable FPS on mobile.
- HUD does not obscure the player lane or upcoming hazards.
- Text and numbers are readable over the moving road.

## Phase 5: Asset Pipeline & Cleanup

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Document image generation prompt templates | S | first batch accepted | repeatable asset style |
| Add asset review checklist | S | prompt templates | consistent QA |
| Remove unused old/generated intermediate assets | S | final references confirmed | smaller bundle |
| Optional: split large Three/game chunks later | M | visual refresh stable | bundle warning reduction |

Automated verification:
- `npm.cmd run test`
- `npm.cmd run build`
- Optional asset audit script for missing files referenced by `characters.ts` and level config.

Manual verification:
- Character lobby on mobile viewport.
- Map selection on mobile viewport.
- Runner page with each theme and each character.
- At least one full run with collision, jump, slide, pause, result.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Asset style drifts between generations | High | generate in batches from approved references and reuse prompt templates |
| PNGs inflate bundle size | Medium | resize to display-appropriate dimensions and optimize PNGs |
| Pretty obstacles hurt gameplay readability | High | test lane visibility and hitbox fairness after each obstacle batch |
| Replacing too many systems at once causes churn | Medium | land one page at a time: characters, lobby, map, runner |

## Rollback Strategy

- Keep old assets until new references are stable.
- Each phase should be a separate commit.
- If a page refresh fails visually, revert only that page's asset references and rendering changes.
- Do not delete old PNGs until the build has passed and manual viewport checks are accepted.

## Suggested Execution Order

1. Finish all character front/back PNGs.
2. Commit character asset mapping.
3. Refresh lobby page.
4. Refresh map selection page.
5. Refresh runner page assets theme by theme.
6. Clean unused assets and optimize bundle size.
