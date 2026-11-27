# Dungeon Crawler Kyle — 0.40.0

Mobile-first pixel-art dungeon RPG, installable as a browser app. Release candidate for solo play and host-trusted private co-op.

## Play
Open https://kyru-koi-san.github.io/Dungeon-Crawler-Kyle/ in Safari. Confirm BUILD 0.40.0 in the header. Use Share → Add to Home Screen for standalone play. Existing campaign saves remain in browser storage; do not clear site data merely to refresh the build.

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
