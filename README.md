# Dungeon Crawler Kyle — 0.41.0

Mobile-first pixel-art dungeon RPG, installable as a browser app. Single-player release candidate; private co-op remains experimental and its deployment is deferred.

## Play
Open https://kyru-koi-san.github.io/Dungeon-Crawler-Kyle/ in Safari. Confirm BUILD 0.41.0 in the header. Use Share → Add to Home Screen for standalone play. Existing campaign saves remain in browser storage; do not clear site data merely to refresh the build.

## Gameplay
- Eighteen progressively smaller dungeon floors, six guardians, distinct floor themes, roaming enemies, hidden bosses, hazards, discoveries and physical safe rooms.
- Character wardrobe, eight races, six classes, twelve subclasses, branching skills and prepared abilities.
- Turn-based encounters, reinforcements, armor, mana recovery, companion pets, recruitable crawlers, loyalty and equipment.
- Ranked loot, reward boxes, item comparisons, dropped bags, sale inventory, city exchanges, achievements, exploratory minimap and campaign save slots.
- Floor two grub multiplication capped at 500 living grubs; bounded rendering caches and pursuit work.
- Private parties of up to four, host-synchronized world and combat, trading, shared loot, reconnect recovery and durable delivery receipts when relay persistence is configured.

## Current validation
GitHub Actions runs npm test on Node.js 22 and 24, including syntax checks, dungeon regression tests and real local WebSocket relay integration tests. The 0.40.0 test run and Pages deployment succeeded. Additional headless checks covered progression gates, guardian rewards, combat formulas and simulated recovery. These do not replace a manual full campaign or physical iPhone test. Co-op still requires a separately hosted relay; GitHub Pages serves static files only.

## Local development
```sh
npm install
npm test
python3 -m http.server 8000
```
Open http://localhost:8000 for local solo testing. Run npm start separately for the relay.

## Private relay hosting
Requires Node.js 20+ and WebSocket-capable hosting with TLS. Run npm install and npm start. Configure:
- PORT: host-assigned port (default 8080).
- ALLOWED_ORIGIN: https://kyru-koi-san.github.io (exact origin, without path).
- DCK_STORAGE_FILE: /data/relay.json (mount a persistent writable private volume at /data).

Use one relay process per storage file. Check /health for ok and persistent status. Enter the host's secure wss:// URL in the game's Party tab, create a room, and share its invite code privately.

Persistent storage checkpoints room state and preserves completed trade receipts and pending deliveries. Unfinished trades are cancelled on restart. Active sessions have a restart recovery window of up to 24 hours; ordinary disconnects retain a two-minute window. Keep reconnect credentials and storage files private and back up the volume.

## Release limitations
This is host-trusted private co-op, not an authoritative commercial multiplayer service. Do not expose it as an unrestricted public service. Account authentication, authoritative simulation, anti-cheat, abuse controls, device testing, privacy/security review and store compliance remain necessary for commercial release. No hosted relay or physical-device verification is claimed by this release.

## 0.41.0 single-player release candidate

Includes mobile suspension checkpoints, regular autosaves, cached inventory and map rendering, dense-floor enemy optimization, offline fallback, snapshot validation, revival and reward fixes, and corrected expedition goals. Targeted headless checks covered base layout reachability on 18 floors and six guardian locations, progression gates and victory, inventory stacking and strike damage. Full campaign playthrough, physical iPhone validation and this version's live Pages deployment are not yet verified. Existing save keys are unchanged.

## Single-player acceptance checklist

Development scope is frozen for the 0.41.0 candidate. Before labeling a build 1.0 stable:

- [ ] Verify the public Pages URL displays BUILD 0.41.0 and loads all art without errors.
- [ ] On iPhone Safari, start a fresh campaign, complete guild induction, walk/run, enter combat, loot and equip a reward.
- [ ] Save to a manual slot, reload, background/resume and verify position and inventory.
- [ ] Add to Home Screen, load once online, then relaunch offline and verify a saved campaign opens.
- [ ] Complete a single-player campaign through floor 18, including floor-four identity registration and all six guardians.

Do not clear website data when refreshing the build. Private co-op is not a blocker for single-player acceptance. These manual checks have not been performed by the development assistant; 0.41.0 remains a release candidate rather than a certified stable release.
