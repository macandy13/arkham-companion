# M8 – Cloud and sync

Goal: games stored in the cloud and shared between several devices at the table.
Ref: product.md "Cloud sync".

**Why this milestone**

- **Problem:** With one tablet, only one person can update the game, and a lost or wiped device loses the campaign. Players want to see and change state from their own phones.
- **What the app gains:** Games and campaigns backed up in the cloud, and several devices at the table showing the same live game.
- **Why at this point:** A backend adds cost, accounts and operations, and a single tablet already covers the core use case – so it comes last. The groundwork is already in place: the `GameStore` interface, UUID game IDs and an append-only event log with `expectedSeq` for optimistic concurrency (architecture "Persistence").

---

## M8.1 Backend decision (O)

**Why:** The backend choice decides cost, authentication and how offline sync works; it should be made once, against explicit criteria.

**Benefit:** A documented, reasoned decision instead of an accidental one.

- [ ] Compare Supabase, Firebase/Firestore and Cloudflare D1 + Durable Objects for: auth, append-only event log, realtime, free tier, offline story
- [ ] Write the decision into product.md "Cloud sync"

## M8.2 Login (S)

**Why:** Cloud storage needs identity, but the app must stay fully usable without an account.

**Benefit:** Optional sign-in; nobody is forced to create an account to play.

- [ ] Sign in (e.g. Google); app keeps working signed out with local storage only

## M8.3 CloudStore (O)

**Why:** Because games are an append-only event log, syncing is "upload new events, and on conflict replay local commands on top" – no complex merging.

**Benefit:** Games are backed up and available on any device the user signs in on.

- [ ] `CloudStore` implementing `GameStore`; IndexedDB remains the offline cache
- [ ] Upload unsynced events; `expectedSeq` conflicts → rebase local commands and retry

## M8.4 Multi-device play (O)

**Why:** Each player should be able to follow and update the shared game on their own device.

**Benefit:** Several phones/tablets at one table showing the same live state.

- [ ] Realtime channel per game; other devices apply incoming events
- [ ] Join a game by link/QR code; roles (host, player)

## M8.5 Sharing and migration (S)

**Why:** Campaigns belong to the group, not one device, and existing local games should not be stranded.

**Benefit:** Shared campaigns and a painless move from local-only to cloud.

- [ ] Share a campaign with fellow players
- [ ] Move existing local games to the cloud
