# Brains & Bets — Streaming Rebuild Plan

## Vision

A 24/7 live-streamed "Wits & Wagers" trivia game running on a Raspberry Pi 3B
(or headless Docker container). Viewers on Twitch/YouTube interact via chat
commands to submit guesses, place bets, and climb a persistent leaderboard.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Raspberry Pi 3B / Docker Container                 │
│                                                     │
│  ┌──────────────┐   frames    ┌──────────────────┐  │
│  │  Game Engine  │──────────▶│  FFmpeg Process   │  │
│  │  (Node.js)   │  (stdin)   │  h264 → RTMP     │──┼──▶ Twitch / YouTube
│  └──────┬───────┘            └──────────────────┘  │
│         │                                           │
│  ┌──────┴───────┐                                   │
│  │  Renderer    │  (node-canvas: Cairo-backed)      │
│  │  720p / 10fps│                                   │
│  └──────────────┘                                   │
│         │                                           │
│  ┌──────┴───────┐                                   │
│  │  Chat Clients │                                  │
│  │  tmi.js (Tw)  │◀──── Twitch IRC                 │
│  │  YT Live API  │◀──── YouTube Chat               │
│  └──────────────┘                                   │
└─────────────────────────────────────────────────────┘
         │
         │ HTTP (score updates)
         ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Edge                                    │
│  ┌──────────────┐    ┌─────────────┐                │
│  │  Worker API   │──▶│  D1 (SQLite) │               │
│  │  /leaderboard │   │  players     │               │
│  │  /scores      │   │  game_results│               │
│  └──────────────┘    └─────────────┘                │
└─────────────────────────────────────────────────────┘
```

---

## The Hard Problem: Rendering on a Pi 3B

### Constraints
- **CPU**: ARM Cortex-A53 quad-core @ 1.2 GHz
- **RAM**: 1 GB
- **GPU**: VideoCore IV (has H.264 hardware encoder via `h264_omx`)
- **No display** needed — headless operation

### Why This Actually Works for a Trivia Game

Unlike a fast-action game, a trivia stream is **mostly static content** that
changes every few seconds. We don't need 30fps of complex animation. We need:

- A background with text overlays (question, timer, scores)
- Updates only when game state changes (new question, new guess, timer tick)
- Occasional transitions between game phases

### Rendering Pipeline

```
node-canvas (720p)                  FFmpeg
─────────────────                   ──────
Draw frame as raw RGBA    ──pipe──▶  -f rawvideo -pix_fmt rgba
  ~2-5 frames/sec                    -s 1280x720
  only on state change               -r 10
                                     -c:v h264_omx (Pi) or libx264 -preset ultrafast (Docker)
                                     -f flv rtmp://...
```

**Key optimizations:**
1. **Dirty-frame rendering** — only render a new frame when state changes,
   otherwise re-send the last frame. Most of the time the screen is static.
2. **Low frame rate** — 10 fps is fine for text-based content. Could even go
   to 5 fps for the Pi 3B.
3. **720p resolution** — 1280x720 is the sweet spot for readability vs. cost.
4. **Hardware encoder on Pi** — `h264_omx` offloads encoding to the GPU,
   dropping CPU load from ~100% to ~10%.
5. **Docker fallback** — `libx264 -preset ultrafast` at 720p/10fps is
   manageable even on modest x86 hardware.

### Alternative: FFmpeg drawtext filters
Instead of rendering full frames, we could use FFmpeg's built-in `drawtext`
filter to overlay text on a static background image. This is lighter but much
less flexible — no custom layouts, no score tables, no dynamic graphics. We
should start with node-canvas and fall back to this if performance is
unacceptable.

---

## Game Flow

```
 ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 │  LOBBY   │────▶│ QUESTION │────▶│ BETTING  │────▶│  REVEAL  │
 │ (30-60s) │     │ (45-60s) │     │ (30-45s) │     │ (15-20s) │
 └──────────┘     └──────────┘     └──────────┘     └──────┬───┘
      ▲                                                     │
      │           ┌──────────┐                              │
      └───────────│  SCORES  │◀─────────────────────────────┘
                  │ (15-20s) │
                  └──────────┘
```

### Phase Details

1. **LOBBY** — Show leaderboard, countdown to next round. New players can
   `!join`. Runs continuously between games (or between individual questions
   in a multi-question game).

2. **QUESTION** — Display the trivia question (always numeric answer).
   Players type `!guess <number>` (or `!g <number>`) in chat.
   Timer counts down. Late guesses ignored.

3. **BETTING** — Guesses are bucketed (k-means clustering into ~5-7 ranges).
   Display the buckets with payout odds. Players type
   `!bet <bucket#> <amount>` (or `!b <bucket#> <amount>`).
   Players who guessed also get to bet.
   Each player can place 1-2 bets on different buckets.

4. **REVEAL** — Show the correct answer. Highlight the winning bucket.
   Brief dramatic pause / animation.

5. **SCORES** — Show round results: who won, how much they won.
   Update the leaderboard. After N rounds, show final standings.
   Loop back to LOBBY.

### Chat Commands

| Command | Description |
|---------|-------------|
| `!join` | Join the current game (get starting chips) |
| `!guess <number>` or `!g <number>` | Submit a numeric guess during QUESTION phase |
| `!bet <bucket> <amount>` or `!b <bucket> <amount>` | Bet on a bucket during BETTING phase |
| `!score` | Check your current score |
| `!top` | Show top 5 leaderboard |
| `!help` | Show available commands |

---

## Tech Stack

### On the Pi / Docker Container

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | **Node.js 20 LTS** | Lightweight, async I/O, good for chat + rendering |
| Rendering | **node-canvas** (Cairo) | Server-side 2D canvas, no browser needed |
| Video encoding | **FFmpeg** (h264_omx or libx264) | Industry standard, RTMP support |
| Twitch chat | **tmi.js** | Mature, anonymous read + authenticated write |
| YouTube chat | **YouTube Live Streaming API** (polling or gRPC `streamList`) | Official API |
| Game engine | **Custom state machine** | Simple phases, timer-driven transitions |
| Process manager | **Docker** with restart policy (or **PM2**) | 24/7 uptime, auto-restart |

### On Cloudflare (Leaderboard)

| Component | Technology | Why |
|-----------|-----------|-----|
| API | **Cloudflare Worker** (Hono framework) | Edge-deployed, fast, free tier generous |
| Database | **Cloudflare D1** (SQLite) | Serverless SQL, pairs with Workers |
| Auth | **Shared secret / API key** | Simple auth for Pi → Worker communication |

---

## D1 Database Schema

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,           -- "twitch:username" or "youtube:channelId"
  platform TEXT NOT NULL,        -- "twitch" or "youtube"
  username TEXT NOT NULL,
  display_name TEXT,
  total_score INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  best_round_score INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE game_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  num_questions INTEGER,
  num_players INTEGER
);

CREATE TABLE round_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  question_text TEXT,
  guess INTEGER,
  bet_result INTEGER DEFAULT 0,   -- chips won/lost
  round_number INTEGER,
  played_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES game_sessions(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX idx_players_score ON players(total_score DESC);
CREATE INDEX idx_round_results_session ON round_results(session_id);
```

### Worker API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/leaderboard?limit=10` | Top N players by total score |
| `GET` | `/player/:id` | Individual player stats |
| `POST` | `/game/start` | Register a new game session |
| `POST` | `/game/:sessionId/round` | Submit round results (batch) |
| `POST` | `/game/:sessionId/end` | End game session |

---

## Project Structure (Proposed)

```
brains-and-bets/
├── src/                        # Game engine (runs on Pi/Docker)
│   ├── index.ts                # Entry point
│   ├── engine/
│   │   ├── game.ts             # Game state machine
│   │   ├── phases.ts           # Phase logic (lobby, question, betting, etc.)
│   │   ├── scoring.ts          # Bet payout calculation, k-means bucketing
│   │   └── questions.ts        # Question loader
│   ├── chat/
│   │   ├── manager.ts          # Unified chat interface
│   │   ├── twitch.ts           # tmi.js wrapper
│   │   ├── youtube.ts          # YouTube Live Chat API wrapper
│   │   └── commands.ts         # Chat command parser
│   ├── renderer/
│   │   ├── stream.ts           # FFmpeg process management, frame piping
│   │   ├── canvas.ts           # node-canvas rendering logic
│   │   ├── scenes/             # Scene renderers for each game phase
│   │   │   ├── lobby.ts
│   │   │   ├── question.ts
│   │   │   ├── betting.ts
│   │   │   ├── reveal.ts
│   │   │   └── scores.ts
│   │   └── assets/             # Fonts, background images
│   ├── leaderboard/
│   │   └── client.ts           # HTTP client for Cloudflare Worker API
│   └── config.ts               # Environment config (stream keys, API keys)
├── worker/                     # Cloudflare Worker (leaderboard API)
│   ├── src/
│   │   ├── index.ts            # Hono app entry point
│   │   ├── routes/
│   │   │   ├── leaderboard.ts
│   │   │   ├── player.ts
│   │   │   └── game.ts
│   │   └── db/
│   │       ├── schema.sql
│   │       └── queries.ts
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── questions/                  # Question bank (JSON files)
│   ├── general.json
│   ├── science.json
│   ├── history.json
│   └── ...
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Key Technical Decisions & Trade-offs

### 1. Frame Rate: 5-10 fps
For a text-heavy trivia game, 10fps is smooth enough. On the Pi 3B with
hardware encoding, this should be comfortable. We can drop to 5fps if needed.
The stream will look fine — most of the "content" is static between state
changes.

### 2. Resolution: 720p (1280x720)
Standard for Twitch/YouTube. Readable text. Half the pixels of 1080p means
half the rendering and encoding work.

### 3. node-canvas vs. alternatives
- **node-canvas (Cairo)**: Battle-tested, full Canvas API, works headless.
  Compilation on ARM can be finicky but doable. This is the pragmatic choice.
- **Skia (via @napi-rs/canvas)**: Faster but less mature, bigger binary.
- **FFmpeg drawtext**: Ultra-light but can't do layouts/tables/graphics.
- **Headless browser (Puppeteer)**: Way too heavy for a Pi 3B.

**Decision**: Start with node-canvas. It's the best balance of flexibility and
resource usage for this use case.

### 4. Chat normalization
Both Twitch (IRC via tmi.js) and YouTube (REST API polling) feed into a
unified `ChatManager` that emits normalized `ChatMessage` events. The game
engine doesn't care which platform a message came from.

### 5. Leaderboard on Cloudflare vs. local SQLite
Could run SQLite locally on the Pi, but Cloudflare D1 gives us:
- A public API for a future web leaderboard page
- No data loss if the Pi's SD card dies
- Foundation for the v2 Jackbox-style browser game
- Free tier is more than enough (100K reads/day, 100K writes/day on D1)

### 6. 24/7 uptime strategy
- **Docker**: `restart: always` policy. Container includes Node.js + FFmpeg.
- **Pi bare-metal**: PM2 with `--restart-delay 5000` and `--max-restarts 100`.
- **Stream reconnection**: If RTMP connection drops, FFmpeg process restarts
  automatically. Game state is preserved in memory.
- **Watchdog**: Simple health check that verifies FFmpeg is running and chat
  connections are alive. Restart components independently if needed.

---

## Open Questions / Things to Decide

1. **Simultaneous multi-platform streaming?**
   FFmpeg's `tee` muxer can output to both Twitch and YouTube RTMP endpoints
   from a single encode. Worth doing from day 1? Or start with one platform?

2. **Question sourcing**:
   - Static JSON files (what we have now)?
   - API-based (trivia APIs)?
   - AI-generated questions?
   - Community-submitted?

3. **New player onboarding**:
   Starting chips? How many? Reset per game or persistent?
   If persistent, what happens when someone hits 0?

4. **Anti-cheat / rate limiting**:
   - One guess per player per round
   - Cooldown on commands
   - Ignore bot accounts?

5. **Audio**:
   - Background music? (Adds complexity — FFmpeg audio mixing)
   - Sound effects for reveals?
   - Start silent (video-only) for simplicity?

6. **v2 Jackbox-style browser play**:
   - Could reuse the same Cloudflare Worker as a signaling server
   - Players connect via browser, see their own UI
   - Stream still shows the "big screen" view
   - WebSocket or Server-Sent Events for real-time updates

---

## Implementation Priority

### Phase 1: Core Loop (MVP)
- [ ] Project scaffolding (TypeScript, build config)
- [ ] Game state machine (phases, timers, transitions)
- [ ] Question loader from JSON files
- [ ] Twitch chat integration (tmi.js) — read guesses + bets
- [ ] Basic renderer (node-canvas → FFmpeg → RTMP)
- [ ] K-means answer bucketing + payout calculation
- [ ] Dockerfile for deployment

### Phase 2: Polish & Persistence
- [ ] Cloudflare Worker + D1 leaderboard
- [ ] YouTube chat integration
- [ ] Better visual design (backgrounds, fonts, colors)
- [ ] Score persistence across games
- [ ] Multi-platform streaming (tee muxer)

### Phase 3: v2 — Browser Play (Jackbox-style)
- [ ] WebSocket server for browser clients
- [ ] Player web UI (phone-friendly)
- [ ] Room codes / join flow
- [ ] Stream view vs. player view separation
