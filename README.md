# Dungeon Crawler Kyle — 0.11.0 Frame Animation & Co-op Alpha

A mobile-first, installable browser RPG prototype. The build now uses a purpose-made pixel-art character/enemy set in live gameplay and includes a first private-room networking slice. The original generated character atlas is retained under `assets/source/` for future art iteration.

## Included in 0.11.0

- Solo dungeon run with generated floors, connected rooms, stairs, and floor guardians.
- More enemy archetypes: hollow skeleton, goblin, crypt spider, ash knight, mire wretch, skeleton archer, and goblin hexer.
- New spider boss and armored bone champion visuals.
- Pixel-art hero front/side/back views, attack art, enemy sprites, and a matching character portrait.
- Combat, dodge, jump, Arc Pulse, loot, inventory, torches, health/mana, XP, leveling, skills, achievements, and AI commentary.
- Explored minimap with red living-enemy dots and white fallen-enemy remains.
- Local campaign save and installable PWA shell with the sprite files precached for offline launch after first successful load.
- Co-op alpha client with private room creation/joining, 6-character invite codes, up to four party members, presence/position sync, and remote crawler rendering.
- Node.js WebSocket relay in the repository root (`relay.js` and `package.json`) with room capacity, input validation, message-size/rate limits, and health endpoint.

## Important co-op status

This is a **multiplayer foundation, not a completed co-op game**. The current relay shares party membership and player position/status snapshots. It does not yet synchronize combat outcomes, enemy AI, dungeon generation, loot, quests, player accounts, reconnect recovery, or authoritative anti-cheat state. A hosted relay is not included; you must deploy the repository-root relay to a Node-capable host and use its secure `wss://` address in the Party tab. The relay uses room codes as invite tokens and is intended for a private alpha only; it is not production authentication.

## Run locally for development

The solo game can be opened from a local static web server. From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. On iPhone, use a published HTTPS host (for example GitHub Pages) and Safari → Share → Add to Home Screen.

## Deploy the web client from an iPhone using GitHub

1. Extract the ZIP on your iPhone or in the Files app.
2. Open your GitHub repository in Safari.
3. Upload the *contents* of `Dungeon_Crawler_Kyle_Final` into the repository root. `index.html` must be at the root, with the JavaScript/CSS files and image assets alongside it.
4. In GitHub repository Settings → Pages, select Deploy from a branch, `main`, and `/(root)`; save.
5. Open the HTTPS Pages URL in Safari and add it to your Home Screen.

If a previous PWA build is installed, close it and reload the hosted page so the `dck-shell-v3` service worker cache can update.

## Deploy the private relay

Requires Node.js 20+ on a server that supports WebSockets.

```bash
npm install
npm start
```

The process listens on `PORT` (default 8080) and exposes `/health`. Set `ALLOWED_ORIGIN` to the exact HTTPS origin hosting the game (for example `https://kyru-koi-san.github.io`) to restrict browser origins. Put it behind a TLS-enabled reverse proxy or a host that provides TLS, then use the resulting `wss://your-host` URL in the Party tab. Do not expose an unauthenticated relay as a public production service. Add account authentication, abuse monitoring, persistence, origin restrictions, and authoritative game simulation before a public release.

## Next engineering milestones before commercial release

1. Server-authoritative shared dungeon state: deterministic floor seed, enemy positions/health, combat events, drops, stairs, and progression.
2. Account identity, secure invites, reconnect/rejoin, host migration, persistence, and abuse/anti-cheat controls.
3. Gameplay content: additional floors/biomes, quest lines, equipment affixes, crafting, NPCs, bosses, balance, and accessibility options.
4. Directional hero walk cycles, a timed four-frame attack sequence, and four-frame enemy animation loops are now included. Remaining art work includes directional enemy attacks/death cycles and authored environment tilesets.
5. Automated gameplay tests, iPhone/Android device testing, privacy/security review, store compliance, and native packaging if required.

## Validation performed for this build

- JavaScript syntax checks for the client and relay.
- ZIP integrity check.
- Local HTTP smoke test for the HTML entry point, networking module, and a served sprite asset.
- A headless Chromium visual run was attempted but timed out in this execution environment; manual iPhone/Android testing is still required.

Real-device testing and a hosted multi-device co-op session have not yet been performed.


## Frame animation update (v0.11.0)

The hero now uses four-frame directional walk cycles (front, back, side), a four-frame attack sequence, and timed movement/attack playback. Enemy archetypes also have four-frame idle/recoil loops. These animation frames are derived from the approved pixel-art character assets and preserve their original style. They are lightweight sprite frames loaded locally and precached for offline play.

For GitHub Pages, upload the contents of this project folder to the repository root (not the enclosing folder). Keep `index.html` at the repository root.

## Relay protocol update

The private relay now accepts host world snapshots up to 512 KiB and 5,000 entities, session-scoped loot claims, ranked item IDs, and eight character races. Ordinary incoming messages remain capped at 8 KiB. Combat remains host-authoritative rather than server-authoritative. Restart/redeploy the Node relay after updating. No live multi-device validation has been completed.

### Persistent relay storage
Set `DCK_STORAGE_FILE=/data/relay.json` on the relay and mount a persistent writable volume at `/data`. Run one relay process per storage file. The relay checkpoints dirty room state about once per second, commits trade receipts before acknowledgment, and cancels unfinished trades after restart. Keep this file private: it contains reconnect and trade tokens. Connected sessions can recover for up to 24 hours after restart; ordinary disconnects retain the two-minute recovery window. The client must retain its reconnect token. Storage is opt-in; without the variable the relay is memory-only. `/health` reports whether persistence is configured and whether a write error occurred. Back up the volume independently. This is host-trusted co-op, not an authoritative multiplayer server.
