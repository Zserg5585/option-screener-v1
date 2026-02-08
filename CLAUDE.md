# Options Screener — Crypto Options Analytics Platform

## Project Overview
Node.js API backend for cryptocurrency options data analysis.
Fetches real-time options data from Binance, analyzes it,
and provides actionable trading signals through REST API
and WebSocket.

## Tech Stack
- Runtime: Node.js 18+
- Framework: Express.js
- Database: PostgreSQL + Prisma ORM
- WebSocket: ws library
- Process Manager: PM2
- Reverse Proxy: Nginx with SSL (Let's Encrypt)

## Directory Structure
src/
├── app.js              — Express + WebSocket init
├── server.js           — Entry point
├── config/index.js     — Environment variables
├── services/
│   ├── binance.js      — Binance API client
│   ├── cache.js        — In-memory cache with TTL
│   ├── scheduler.js    — Cron data refresh (5 min)
│   └── db.js           — Prisma client singleton
├── analysis/
│   ├── unusualVolume.js
│   ├── topMovers.js
│   ├── maxPain.js
│   ├── ivAnalysis.js
│   ├── putCallRatio.js
│   ├── ivSkew.js
│   ├── gammaPlay.js
│   └── oiConcentration.js
├── routes/
│   ├── health.js
│   ├── options.js
│   └── signals.js
├── websocket/index.js
└── middleware/
├── auth.js
└── rateLimit.js
## API Endpoints
- GET /health
- GET /api/options
- GET /api/expiries
- GET /api/summary
- GET /api/top-movers
- GET /api/unusual-volume
- GET /api/signals/unusual-volume
- GET /api/signals/iv-analysis
- GET /api/signals/max-pain
- GET /api/signals/oi-concentration
- GET /api/signals/put-call-ratio
- GET /api/signals/iv-skew
- GET /api/signals/gamma-play

## Code Style
- const over let, never var
- Async/await over callbacks
- API responses: { success: true, data: {} }
- Logs: [ISO timestamp] message
- Commits: type: description (feat, fix, refactor, docs)

## Deployment
- Server: Ubuntu, IP 76.13.138.220
- Domain: options.szhub.space (SSL)
- PM2: pm2 start src/server.js --name options-api
- Nginx proxies 443 → localhost:8080
