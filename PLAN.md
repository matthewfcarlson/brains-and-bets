# Brains & Bets — Streaming Rebuild Plan

## Vision

A 24/7 live-streamed "Wits & Wagers" trivia game running on a Raspberry Pi 3B
(or headless Docker container). Viewers on Twitch/YouTube interact via chat
commands to submit guesses, place bets, and climb a persistent leaderboard.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Raspberry Pi 3B / Docker Container                          │
│                                                              │
│  ┌──────────────┐                                            │
│  │  Game Engine  │  (state machine, timers, player mgmt)     │
│  └──────┬───────┘                                            │
│         │ state changes                                      │
│  ┌──────┴───────┐                  ┌──────────────────────┐  │
│  │  Renderer    │──video(pipe:3)──▶│                      │  │
│  │  node-canvas │                  │  FFmpeg Process      │  │
│  │  720p/10fps  │                  │  h264 + AAC → RTMP   │──┼──▶ Twitch
│  └──────────────┘                  │  (tee muxer)         │──┼──▶ YouTube
│  ┌──────────────┐                  │                      │  │
│  │  Audio Mixer │──audio(pipe:4)──▶│                      │  │
│  │  BG music +  │                  └──────────────────────┘  │
│  │  SFX triggers│                                            │
│  └──────────────┘                                            │
│         │                                                    │
│  ┌──────┴───────┐                                            │
│  │  Chat Clients │                                           │
│  │  tmi.js (Tw)  │◀──── Twitch IRC                          │
│  │  YT Live API  │◀──── YouTube Chat (polling)               │
│  └──────────────┘                                            │
└──────────────────────────────────────────────────────────────┘
         │
         │ HTTP (score updates)
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Edge                                             │
│  ┌──────────────┐    ┌─────────────┐                         │
│  │  Worker API   │──▶│  D1 (SQLite) │                        │
│  │  /leaderboard │   │  players     │                        │
│  │  /scores      │   │  game_results│                        │
│  └──────────────┘    └─────────────┘                         │
└──────────────────────────────────────────────────────────────┘
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

### Rendering + Audio Pipeline

```
node-canvas (720p)                  FFmpeg (dual-input via extra file descriptors)
─────────────────                   ──────────────────────────────────────────────
Draw frame as raw RGBA              -f rawvideo -pix_fmt rgba -s 1280x720 -r 10
  → write to pipe:3       ──fd3──▶  -i pipe:3

audio-mixer (Node.js)               -f s16le -ar 48000 -ac 2
  BG music loop + SFX     ──fd4──▶  -i pipe:4
  → write to pipe:4
                                     -c:v h264_omx (Pi) or libx264 ultrafast (Docker)
                                     -c:a aac -b:a 192k
                                     -f tee "[f=flv]rtmp://twitch|[f=flv]rtmp://youtube"
```

**Audio approach**: The `audio-mixer` npm package runs in Node.js, continuously
outputting mixed PCM (s16le, 48kHz, stereo). Background music loops via stream
restart (`stream.on('end', restart)`). Sound effects are piped into a separate
mixer input on game events (correct answer, betting opens, reveal, etc.).
Both video and audio reach FFmpeg via extra stdio file descriptors (pipe:3,
pipe:4) — no named pipes or filesystem artifacts needed.

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
| Audio mixing | **audio-mixer** (npm) | Per-input volume, continuous PCM output, dynamic SFX |
| Video+Audio encoding | **FFmpeg** (h264_omx or libx264 + AAC) | Industry standard, RTMP, tee muxer |
| Twitch chat | **tmi.js** | Mature, anonymous read + authenticated write |
| YouTube chat | **YouTube Live Streaming API** (polling) | Official API, ~5s polling interval |
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
│   │   └── scenes/             # Scene renderers for each game phase
│   │       ├── lobby.ts
│   │       ├── question.ts
│   │       ├── betting.ts
│   │       ├── reveal.ts
│   │       └── scores.ts
│   ├── audio/
│   │   ├── mixer.ts            # audio-mixer setup, BG music loop, SFX triggers
│   │   └── sfx.ts              # Sound effect event mapping
│   ├── assets/
│   │   ├── fonts/              # Custom fonts for rendering
│   │   ├── images/             # Background images, logos
│   │   └── audio/              # Pre-converted .pcm files (BG music, SFX)
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

### 6. Audio pipeline
The `audio-mixer` npm package provides per-input volume control and continuous
PCM output. Architecture:

```js
// Background music: loops forever via stream restart
const bgInput = mixer.input({ volume: 25 }); // 25% volume
function loopMusic() {
  const stream = createReadStream('background.pcm');
  stream.pipe(bgInput, { end: false });
  stream.on('end', loopMusic);
}

// Sound effects: triggered on game events, piped to a separate input
const sfxInput = mixer.input({ volume: 100 });
function playSfx(file) {
  createReadStream(file).pipe(sfxInput, { end: false });
}

// Mixed output → FFmpeg pipe:4
mixer.pipe(ffmpegProcess.stdio[4]);
```

Audio files must be pre-converted to raw PCM (s16le, 48kHz, stereo):
```bash
ffmpeg -i music.mp3 -f s16le -acodec pcm_s16le -ar 48000 -ac 2 music.pcm
```

### 7. FFmpeg dual-output command
```bash
ffmpeg \
  -f rawvideo -pix_fmt rgba -video_size 1280x720 -framerate 10 \
    -fflags nobuffer -thread_queue_size 512 -i pipe:3 \
  -f s16le -ar 48000 -ac 2 \
    -fflags nobuffer -analyzeduration 0 -thread_queue_size 512 -i pipe:4 \
  -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p \
    -g 20 -b:v 2500k -maxrate 2500k -bufsize 5000k \
  -c:a aac -b:a 192k -ar 44100 \
  -map 0:v:0 -map 1:a:0 -vsync cfr -af "aresample=async=1" \
  -f tee \
  "[f=flv]rtmp://live.twitch.tv/app/TWITCH_KEY|[f=flv]rtmp://a.rtmp.youtube.com/live2/YT_KEY"
```

On Pi 3B, replace `-c:v libx264 -preset ultrafast` with `-c:v h264_omx`.

### 8. 24/7 uptime strategy
- **Docker**: `restart: always` policy. Container includes Node.js + FFmpeg.
- **Pi bare-metal**: PM2 with `--restart-delay 5000` and `--max-restarts 100`.
- **Stream reconnection**: If RTMP connection drops, FFmpeg process restarts
  automatically. Game state is preserved in memory.
- **Watchdog**: Simple health check that verifies FFmpeg is running and chat
  connections are alive. Restart components independently if needed.

---

## Confirmed Decisions

1. **Both platforms from day 1.** Twitch + YouTube simultaneously using
   FFmpeg's `tee` muxer. Single encode, dual RTMP output.

2. **Audio is a must.** Background music loop + sound effects for game events
   (betting opens, answer reveal, correct/wrong, game over). Mixed in Node.js
   via `audio-mixer` and piped to FFmpeg alongside video frames.

3. **Reuse existing JSON question files.** The repo has ~590+ questions across
   6 categories (general, halloween, christmas, thanksgiving, carlson, howarth).
   Format: `[question, answer]` or `[question, answer, explanation]`.
   More will be generated later.

4. **Chips reset per game. 3 starting chips. Percentile-based leaderboard payout.**
   - Every player starts each game with **3 chips**
   - Low chip count = every bet is high-stakes and meaningful
   - Bet sizing: 1, 2, or all 3 on a single bucket, or split (e.g. 1 + 2)
   - At game end, players are ranked by chip count
   - Leaderboard points awarded by **percentile tier**:

   | Finish Percentile | Leaderboard Points |
   |-------------------|--------------------|
   | Top 1%            | 100                |
   | Top 2%            | 75                 |
   | Top 3%            | 60                 |
   | Top 5%            | 50                 |
   | Top 10%           | 35                 |
   | Top 25%           | 20                 |
   | Top 50%           | 10                 |
   | Top 75%           | 5                  |
   | Below 75%         | 1 (participation)  |

   - Ties: all tied players receive the best tier they qualify for
   - Minimum players for a game to count: 3 (below that, no points awarded)
   - Leaderboard tracks cumulative points across all games

5. **Anti-cheat / rate limiting:**
   - One guess per player per round (first guess counts)
   - One bet command per player per round (or two bets max like original game)
   - Basic rate limiting on all commands
   - Ignore known bot accounts

## Remaining Open Questions

1. **What happens if no one joins a round?** — Skip? Show fun fact? Idle screen?
2. **Music licensing** — need royalty-free background music and SFX.
   Could use CC0/public domain tracks or generate with AI.
3. **Payout multipliers per bucket** — keep the original Wits & Wagers style
   (2:1 to 6:1 based on bucket position) or simplify?

---

## Implementation Priority

### Phase 1: Core Loop (MVP)
- [ ] Project scaffolding (TypeScript, Node.js, build config — replace Vite/React)
- [ ] Game state machine (phases, timers, transitions)
- [ ] Question loader from existing JSON files
- [ ] Chat integration — Twitch (tmi.js) + YouTube (Live Chat API) with unified ChatManager
- [ ] Chat command parser (!guess, !bet, !join, !score, !top, !help)
- [ ] Video renderer (node-canvas → pipe:3 → FFmpeg) with scenes per phase
- [ ] Audio pipeline (audio-mixer → pipe:4 → FFmpeg) with BG music + SFX
- [ ] FFmpeg process manager (tee muxer → Twitch + YouTube RTMP)
- [ ] K-means answer bucketing + payout calculation
- [ ] Per-game chip system (start with N chips, bet/win/lose)
- [ ] Dockerfile for deployment

### Phase 2: Persistence & Polish
- [ ] Cloudflare Worker + D1 leaderboard API
- [ ] End-of-game chip → leaderboard point conversion + HTTP submission
- [ ] Leaderboard display on stream (lobby phase)
- [ ] Visual polish (backgrounds, fonts, animations, transitions)
- [ ] Sound design (find/create royalty-free BG music + SFX pack)
- [ ] Reconnection / watchdog for 24/7 uptime
- [ ] Player stats API endpoint

### Phase 3: v2 — Browser Play (Jackbox-style)
- [ ] WebSocket server for browser clients (possibly via Cloudflare Durable Objects)
- [ ] Player web UI (phone-friendly)
- [ ] Room codes / join flow
- [ ] Stream view vs. player view separation
- [ ] Hybrid mode: chat players + browser players in the same game
