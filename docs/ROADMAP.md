# Roadmap

## Current Phase: Phase 1 — Foundation ✅ (in progress)

Goal: A runnable world. Player walks across terrain, sun moves, world breathes.

- [x] Project scaffold (Vite + TypeScript + Babylon.js)
- [x] EventBus and shared types
- [x] Procedural terrain with LOD chunk streaming
- [x] Day/night cycle (core state + sky visuals)
- [x] Weather state machine (clear → cloudy → rain → storm)
- [x] Third-person player controller (WASD + camera)
- [x] Horse controller (mount/dismount, follow AI)
- [x] Dead Eye system (Q to toggle, time scale)
- [x] Random encounter manager (proximity spawn)
- [x] Honor system (combat kills → float value)
- [x] HUD (health, Dead Eye meter, honor, time)
- [ ] Run `npm run dev` and verify in browser

## Phase 2 — Game Feel

Goal: The vertical slice is playable end-to-end.

- [ ] Real heightmap asset (replace sine-wave approximation)
- [ ] Grass/rock texture blending on terrain (Babylon multi-material)
- [ ] Vegetation instancing (trees, shrubs, cacti)
- [ ] Ambient audio (wind loop, distant birdsong, crickets at night)
- [ ] Complete encounter arc: bandit ambush NPC AI moves toward player
- [ ] Shooting mechanic: left-click fires, raycast hit detection
- [ ] Dead Eye locks targets with mouse click, fires all on deactivate
- [ ] Horse gallop animation (placeholder skeleton animation)
- [ ] NPC death animation (ragdoll or fall-over tween)

## Phase 3 — Polish (in progress)

Goal: Demo-ready. 10-minute play session feels cinematic.

- [x] Golden hour / sunrise / sunset atmospheric scattering (SkyMaterial)
- [x] Shadow casting from directional light (2048 PCF soft shadows)
- [x] Post-processing: bloom, ACES tone mapping, vignette, grain, SSAO, MSAA
- [x] Vertex-colored terrain (height/slope zone blending)
- [x] Minimap (top-down canvas, player heading + encounter blips)
- [x] Pause menu (Esc — controls reference, gates simulation)
- [x] Build + deploy to static host (Vercel, auto-deploy on push)
- [ ] Encounter: injured traveler dialogue pop-up
- [ ] Camp/fire rest mechanic (time skip + health regen)
- [ ] Ambient audio (wind loop, gunshots, hoofbeats — Web Audio)
- [ ] Settings (volume, sensitivity)
- [ ] Performance pass — profile and tune LOD distances

## Deferred (Post-Slice)

- Hunting and fishing mini-games
- Cinematic story mission framework
- Social hub / camp with named NPCs
- Horse bonding tier visible effects (saddle upgrades, faster response)
- Save system (IndexedDB)
