<div align="center">

# ![nav_logo](https://github.com/user-attachments/assets/c38fae85-e277-43b6-af22-258cb72b9965)

# HikmahSphere

### The Unified Islamic Digital Platform · v3.0 Beta

**Free · Ad-free · Privacy-first tools for worship, learning, and community**

[Live site](https://hikmahsphere.site) · [Report issues](https://github.com/yani2298/HikmahSphere/issues) · [Contribute](CONTRIBUTING.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-5.1-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)

</div>

---

## About

HikmahSphere is an open-source Islamic web app for prayer tools, Quran study, dhikr, zakat/maktab workflows, community spaces, and Hajj guidance — in one place.

---

## How to use the website

Anyone can open the live site or a local install and use these areas from the top navigation:

| Page | What you can do |
|------|-----------------|
| **Home** | Overview of features and quick links |
| **About** | Mission, roadmap, and project story |
| **Prayer → Prayer Times** | Daily / monthly / Ramadan schedules; set location or city; calculation method & madhab |
| **Prayer → Qibla** | Live compass and map fallback |
| **Prayer → Find Mosque** | Nearby mosques with directions |
| **Dhikr & Dua** | Adhkar library, favorites, online tasbih |
| **Quran → Reader** | Read with Indo-Pak script, translations, audio, bookmarks |
| **Quran → Tafsir** | Bayan-ul-Quran and Tafheem with translations |
| **Zakat** | Calculate zakat (nisab, assets). Managers/admins also manage fund ledgers |
| **Maktab** | Learn about / enquire to sponsor free Islamic education for children |
| **Community** | Forums, posts, events, meetings, Islamic quiz games |
| **Hajj Guide** | Step-by-step pilgrimage guidance |
| **Contact** | Send support / feedback |

**After you create an account** (Auth → Register / Login):

- **Profile** — update your details and preferences  
- **Salah Tracker** — log daily prayers and Quran reading (streaks & heatmaps)  
- **Settings** (gear icon) — Asr method, prayer notification / Adhan options  
- **Notifications** (bell) — in-app history; allow browser notifications for Adhan/push  
- **Dashboard** — managers/superadmins: users, funds, broadcast push  

**Tip:** Install as a PWA (browser install prompt / Add to Home Screen) for a fuller app feel and better push support on phones.

---

## Features (developer summary)

**Working today:** Prayer Times, Qibla, Mosque Finder, Quran Reader (Indo-Pak, audio, bookmarks), Tafsir, Dhikr & Dua + tasbih, Zakat calculator + role-gated fund ledgers, Maktab campaign, Community (forums/posts/events/meetings/quizzes), Hajj Guide, Salah Tracker, JWT auth & dashboard, FCM/Adhan notifications, PWA install, i18n (`en` / `ar` / `ur`).

**Coming soon:** AI Assistant (UI teaser only); global dark-mode toggle (Quran/Qibla have their own themes).

> Zakat/Maktab funds are **manual ledgers** (UPI / bank / cash / cheque + optional proof). No Stripe/Razorpay gateway.

---

## Prerequisites

- **Node.js** 18+ (20.x recommended) — [nodejs.org](https://nodejs.org/)
- **MongoDB** 6+ (local or Atlas) — or use Docker Compose which includes it
- **Redis** (caching; included in Docker Compose)
- **Git**
- Optional: **Docker** + Docker Compose for the full stack in containers

---

## Install and run (local development)

This is the recommended way to develop and try the code on your machine.

### 1. Clone

```bash
git clone https://github.com/yani2298/HikmahSphere.git
cd HikmahSphere
```

### 2. Install dependencies

```bash
npm run install-deps
```

This installs root, `frontend/`, and `backend/` packages.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` at minimum:

| Variable | Example / notes |
|----------|-----------------|
| `MONGODB_URI` | `mongodb://localhost:27017/hikmahsphere` or your Atlas URI |
| `JWT_SECRET` | Long random string |
| `REFRESH_TOKEN_SECRET` | Long random string |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` |
| `ISLAMIC_API_KEY` | If required by your prayer/nisab provider |
| `REACT_APP_API_URL` | Leave as `/api` for local proxy, or full backend URL |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Needed for Mosque Finder |
| `REACT_APP_FIREBASE_VAPID_KEY` | Required for web push; set in Vercel and redeploy |
| `FIREBASE_SERVICE_ACCOUNT` | Required on Render for push delivery; full JSON from the same Firebase project |
| `CORS_ORIGIN` | Production frontend origins allowed to register tokens and send heartbeats |

There is **no** `backend/.env.example` — use the **root** `.env.example`. Frontend-only extras: `frontend/.env.example`.

### 4. Start MongoDB and Redis

If not using Docker for DBs, start them locally so the backend can connect.

### 5. Run the app

```bash
npm run dev
```

This starts:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api |
| Health check | http://localhost:5000/health |

In development the frontend proxies `/api` → `http://127.0.0.1:5000`.

### 6. First visit checklist

1. Open http://localhost:3000  
2. Try **Prayer Times** (allow location or search a city)  
3. Open **Quran** / **Dhikr & Dua** without an account  
4. **Register** a user to use Salah Tracker and Community games  
5. Use **Contact** if you need to test the support form (SMTP must be configured for email delivery)

### Run frontend or backend alone

```bash
# Frontend only
cd frontend && npm start

# Backend only
cd backend && npm run dev
```

### Build for production (local)

```bash
npm run build
```

---

## Install and run (Docker Compose)

Runs frontend, backend, MongoDB, and Redis together.

```bash
git clone https://github.com/yani2298/HikmahSphere.git
cd HikmahSphere
cp .env.example .env
# Edit secrets and ports if needed

docker compose up -d --build
# If your Docker is older: docker-compose up -d --build
```

Then open http://localhost:3000 (API on http://localhost:5000).

Useful commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose down
```

More detail: [DOCKER-SETUP.md](DOCKER-SETUP.md), [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Production deploy (PM2 + nginx)

On a configured Linux server (not a Docker “one-click” wizard):

```bash
./deploy/deploy.sh
```

Helpers: `deploy/verify.sh`, `deploy/restart-docker.sh`, `deploy/setup-uploads.sh`.

> `deploy/start.sh` and `deploy/stop.sh` are **not** in this repository.

---

## Keeping the free Render backend awake

Render Free web services sleep after 15 minutes without public inbound traffic.
The backend's internal prayer-cache scheduler does not count as public traffic.
For best-effort free availability:

1. Deploy the latest backend so `GET /health/keepalive` is available.
2. In [Better Stack Uptime](https://betterstack.com/uptime), create an HTTP monitor:
   - URL: `https://hikmahsphere-backend.onrender.com/health/keepalive`
   - Check frequency: 3 minutes
   - Expected HTTP status: `200`
   - Response keyword: `"keepalive":true`
3. Keep `.github/workflows/render-keepalive.yml` enabled on the repository's
   default branch as a five-minute fallback.
4. Confirm Render logs contain `GET /health/keepalive 200` at intervals shorter
   than 15 minutes. The endpoint includes `uptimeSeconds`; an unexpectedly small
   value indicates that Render restarted the process.

GitHub scheduled workflows can be delayed or dropped and are disabled after 60
days without repository activity in public repositories, so they should not be
the only monitor. This setup is best effort: only a paid Render instance removes
idle spin-down and provides an always-on hosting guarantee.

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18.3, TypeScript, CRA, Tailwind 3, React Router 6, TanStack Query, axios, Firebase Messaging, i18next |
| Backend | Node 20, Express 5.1, Mongoose (MongoDB 6), Redis 7, JWT, Firebase Admin, Nodemailer, SQLite (IndoPak Quran) |
| Auth roles | `user`, `manager`, `superadmin` |

No AI/RAG backend in this repo.

---

## Project layout

```
HikmahSphere/
├── frontend/          # React SPA
├── backend/           # Express API
├── deploy/            # PM2 / nginx production scripts
├── docker-compose.yml
├── Dockerfile
├── ecosystem.config.js
└── .env.example
```

### Main API mounts

| Mount | Purpose |
|-------|---------|
| `/api/auth` | Register, login, profile |
| `/api/prayers` | Times, fasting, Ramadan, weather, Qibla, Hijri |
| `/api/quran` | Surahs, search, tafsir, IndoPak |
| `/api/dhikr` | Dhikr / tasbih user state |
| `/api/zakat` | Calculate + fund ledger |
| `/api/maktab` | Maktab contribution ledger |
| `/api/community` | Forums, posts, events, meetings |
| `/api/notifications` | FCM tokens, history, broadcast |
| `/api/salah-tracker` | Prayer habit tracking |
| `/api/hajj-guide` | Guide pages |
| `/api/games` | Quizzes / leaderboard |
| `/api/support` | Contact + newsletter |
| `/api/activity` | Admin activity logs |
| `/api/users` | Preferences, location, push prefs |

Health: `GET /health` or `GET /api/health`.

---

## Troubleshooting

**Port already in use**

```bash
npx kill-port 3000 5000
```

**MongoDB connection errors** — confirm Mongo is running and `MONGODB_URI` matches.

**Frontend compiles but API fails** — start the backend (`npm run dev` from root, or `cd backend && npm run dev`).

**Mosque Finder empty** — set `REACT_APP_GOOGLE_MAPS_API_KEY`.

**Push / Adhan not working** — allow notifications in the browser; on iPhone, install to Home Screen first; configure Firebase VAPID + Admin credentials.

**TypeScript / compile errors after pull**

```bash
cd frontend && rm -rf node_modules/.cache && npm start
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Prefer accurate Islamic content with clear sources.

---

## More docs

| Doc | Topic |
|-----|--------|
| [INSTALL.md](INSTALL.md) | Extra install notes |
| [DOCKER-SETUP.md](DOCKER-SETUP.md) | Docker Compose |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment |
| [frontend/README.md](frontend/README.md) | Frontend scripts |

Older INSTALL/DOCKER docs may still mention missing `start.sh` / `stop.sh` — prefer the commands in **this** README.

---

## License

[MIT License](LICENSE)

---

<div align="center">

**Built for the global Muslim Ummah** · [hikmahsphere.site](https://hikmahsphere.site)

جزاكم الله خيراً

</div>
