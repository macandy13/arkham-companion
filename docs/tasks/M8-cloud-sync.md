# M8 – Cloud and sync

Goal: games stored in the cloud and shared between several devices at the table.
Ref: architecture §10 "Later: cloud and multi-device sync".

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.

---

## M8.1 Backend decision (O)

- [ ] Compare Supabase, Firebase/Firestore and Cloudflare D1 + Durable Objects for: auth, append-only event log, realtime, free tier, offline story
- [ ] Write the decision into architecture §10

## M8.2 Login (S)

- [ ] Sign in (e.g. Google); app keeps working signed out with local storage only

## M8.3 CloudStore (O)

- [ ] `CloudStore` implementing `GameStore`; IndexedDB remains the offline cache
- [ ] Upload unsynced events; `expectedSeq` conflicts → rebase local commands and retry

## M8.4 Multi-device play (O)

- [ ] Realtime channel per game; other devices apply incoming events
- [ ] Join a game by link/QR code; roles (host, player)

## M8.5 Sharing and migration (S)

- [ ] Share a campaign with fellow players
- [ ] Move existing local games to the cloud
