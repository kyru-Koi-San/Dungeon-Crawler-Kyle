# Dungeon Crawler Kyle 0.11.0

## Frame animation milestone
- Added four-frame hero walk cycles for down, up, and side directions.
- Added a four-frame hero attack sequence.
- Added four-frame animation loops for skeleton, goblin, spider, wraith, archer, shaman, spider boss, and bone champion.
- Added animation timing to the live render loop; enemy frames advance while the game is running and the hero selects walk/attack frames during the corresponding action windows.
- Updated the service-worker cache to v3 and precached all 61 sprite PNGs for offline use after the first successful load.

## Existing gameplay retained
Solo campaign, generated dungeon floors, combat, 360-degree nearby targeting, dodge, jump, Arc Pulse, inventory, torches, loot/remains, achievements, AI commentary, explored minimap, and local save.

## Co-op status — alpha only
Private rooms, invite codes, and remote player presence/position sync are present. This is not yet synchronized co-op gameplay: combat, enemy state, loot, quests, campaign persistence, reconnect recovery, player identity, and authoritative anti-cheat are not shared. The relay is a scaffold and must be separately deployed behind TLS before remote play.

## Release limitations
This is a playable web/PWA prototype, not a store-ready commercial release. No live relay deployment, App Store/Play Store packaging, iPhone/Android device certification, hosted multi-device test, or full production security review has been completed. Generated environment art is still procedurally drawn rather than a complete authored tileset.
