# SangamAI

> A collaborative AI workspace where personal chats, shared projects, realtime sessions, and team context live in one place.

SangamAI is a full-stack AI collaboration platform built with a React/Vite frontend and a Spring Boot backend. It supports personal AI chats, shared workspaces, environment-based collaboration, threaded AI discussions, realtime streaming, file-backed project context, friends/social features, and account management.

## Highlights

- Personal AI chat workspace
- Shared projects with files and memory/context
- Realtime collaborative AI sessions
- Threaded follow-ups on specific response sections
- Friends and social layer
- Profile, avatar, appearance, and password management
- Google authentication support
- Realtime updates powered by `Centrifugo`

## Product Experience

SangamAI combines two interaction models:

- `Personal workspace`
  - start private AI chats
  - organize work into projects
  - attach knowledge and files

- `Collaborative environments`
  - invite people into shared spaces
  - run AI sessions together
  - branch into nested discussions on specific AI output

## Monorepo Structure

```text
.
├─ Sangam-frontend/   # Vite + React + TypeScript client
├─ Sangam-backend/    # Spring Boot API
├─ centrifugo/        # Realtime server container setup
├─ storage/           # Local file storage during development
└─ walkthrough.md     # project notes / earlier walkthrough
```

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Framer Motion
- Centrifuge JS client
- React Markdown + Prism

### Backend

- Java 21
- Spring Boot 3
- Spring Web + WebFlux
- Spring Security
- JWT authentication
- Spring Data JPA
- PostgreSQL
- Flyway migrations
- Redis + Redisson
- Spring Mail

### Realtime

- Centrifugo

## Architecture

```text
Frontend (React/Vite)
        |
        | REST + JWT
        v
Backend (Spring Boot)
        |
        | JPA / Flyway
        +------> PostgreSQL
        |
        | Queue / coordination
        +------> Redis / Redisson
        |
        | publish / token issuance
        +------> Centrifugo
        |
        | AI provider (OpenAI-compatible)
        +------> Groq / OpenAI / Gemini / others
```

## Backend Domains

The backend is organized into focused modules:

- `auth`
  - JWT auth
  - email/password login and signup
  - Google auth
  - password reset OTP flow

- `user`
  - current user profile
  - avatar upload
  - appearance preference
  - password change

- `friend`
  - friend requests
  - friend profile lookup

- `workspace`
  - projects
  - project members
  - project memory entries
  - project files
  - solo chats and messages

- `environment`
  - collaborative environments
  - environment members and roles

- `session`
  - shared AI sessions
  - conversation nodes
  - paragraph anchors / nested discussion structure

- `realtime`
  - Centrifugo connection info
  - realtime publishing integration

## Database Migrations

Flyway migrations are tracked in:

`Sangam-backend/src/main/resources/db/migration`

Current migrations include:

- users
- environments and members
- sessions
- conversation nodes
- paragraph anchoring
- projects
- solo chats and messages
- project memory and files
- profile preferences and avatars
- friend requests
- group projects
- password reset OTPs

## Why Centrifugo Is Used

SangamAI uses `Centrifugo` for realtime delivery between backend and frontend.

### What the backend uses Centrifugo for

- issuing short-lived connection tokens for authenticated clients
- returning the public websocket endpoint to the frontend
- publishing live updates to channels
- streaming collaborative session output
- delivering incremental chat/session events without constant polling

### Why it exists in this stack

Without Centrifugo, the backend would need to directly own websocket fanout, connection state, and streaming delivery. Centrifugo gives SangamAI:

- reliable websocket delivery
- channel-based pub/sub
- cleaner separation between API logic and realtime transport
- a scalable way to push streamed AI content to multiple collaborators

### Centrifugo-related backend config

These backend settings are used for Centrifugo integration:

```properties
centrifugo.api-url=${CENTRIFUGO_API_URL:}
centrifugo.api-key=${CENTRIFUGO_API_KEY:}
centrifugo.token-secret=${CENTRIFUGO_TOKEN_SECRET:}
app.realtime.ws-url=${REALTIME_WS_URL:}
```

### Local Centrifugo defaults

In `application-local.properties`:

```properties
centrifugo.api-url=http://localhost:8001
centrifugo.api-key=my-api-key
centrifugo.token-secret=my-secret-token-key-that-is-long-enough-for-hmac
app.realtime.ws-url=ws://localhost:8001/connection/websocket
```

### Centrifugo container in this repo

`centrifugo/entrypoint.sh` dynamically generates a Centrifugo config from environment variables:

- `CENTRIFUGO_API_KEY`
- `CENTRIFUGO_TOKEN_SECRET`
- `CENTRIFUGO_ALLOWED_ORIGINS`
- `PORT`

The repo’s Centrifugo container is defined in:

- `centrifugo/Dockerfile`
- `centrifugo/entrypoint.sh`

## Local Development

### Requirements

- Node.js
- Java 21
- Maven Wrapper
- Docker

### 1. Start local services

#### PostgreSQL

```powershell
docker run -d --name sangam-postgres `
  -e POSTGRES_DB=sangamai `
  -e POSTGRES_USER=sangamai_user `
  -e POSTGRES_PASSWORD=changeme `
  -p 5432:5432 `
  postgres:16
```

#### Redis

```powershell
docker run -d --name sangam-redis `
  -p 6379:6379 `
  redis:7
```

#### Centrifugo

Build the local image from the repo:

```powershell
docker build -t sangamai-centrifugo .\centrifugo
```

Then run it:

```powershell
docker run -d --name sangam-centrifugo `
  -e CENTRIFUGO_API_KEY=my-api-key `
  -e CENTRIFUGO_TOKEN_SECRET=my-secret-token-key-that-is-long-enough-for-hmac `
  -e CENTRIFUGO_ALLOWED_ORIGINS=http://localhost:5173 `
  -p 8001:8000 `
  sangamai-centrifugo
```

### 2. Run the backend

From `Sangam-backend`:

```powershell
$env:SPRING_PROFILES_ACTIVE="local"
$env:JWT_SECRET="0123456789abcdef0123456789abcdef"
$env:AI_API_KEY="your_ai_provider_key"
$env:GOOGLE_CLIENT_ID="your_google_client_id"
.\mvnw spring-boot:run
```

Backend local defaults come from:

`Sangam-backend/src/main/resources/application-local.properties`

### 3. Run the frontend

Create `Sangam-frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Then run:

```powershell
cd Sangam-frontend
npm install
npm run dev
```

### Local URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Centrifugo: `http://localhost:8001`

## Environment Variables

### Backend

| Variable | Purpose |
|---|---|
| `PORT` | backend server port in deployment |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | allowed frontend origins |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | PostgreSQL username |
| `SPRING_DATASOURCE_PASSWORD` | PostgreSQL password |
| `SPRING_DATA_REDIS_HOST` | Redis host |
| `SPRING_DATA_REDIS_PORT` | Redis port |
| `SPRING_DATA_REDIS_PASSWORD` | Redis password if enabled |
| `JWT_SECRET` | JWT signing secret |
| `AI_API_KEY` | AI provider key |
| `GOOGLE_CLIENT_ID` | Google auth client ID |
| `CENTRIFUGO_API_URL` | backend-to-Centrifugo API base URL |
| `CENTRIFUGO_API_KEY` | Centrifugo HTTP API key |
| `CENTRIFUGO_TOKEN_SECRET` | Centrifugo token HMAC secret |
| `REALTIME_WS_URL` | public websocket URL for frontend clients |
| `PROJECT_FILES_DIR` | local project file storage directory |
| `SPRING_MAIL_HOST` | SMTP host |
| `SPRING_MAIL_PORT` | SMTP port |
| `SPRING_MAIL_USERNAME` | SMTP username |
| `SPRING_MAIL_PASSWORD` | SMTP password |
| `MAIL_FROM_EMAIL` | sender email |
| `MAIL_FROM_NAME` | sender display name |

### Frontend

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | backend API base URL |

## AI Provider Configuration

The backend is written against an OpenAI-compatible API surface.

Current default in `application.properties` is:

- base URL: `https://api.groq.com/openai`
- model: `llama-3.3-70b-versatile`

Other providers are already documented in config comments, including:

- OpenAI
- Groq
- Gemini
- Together AI
- Mistral

## Deployment

This project has been prepared for:

- `Vercel` for frontend
- `Render` for backend
- Render PostgreSQL
- Render Key Value / Redis
- Render-hosted Centrifugo

### Deployment notes

- backend uses env-driven DB, Redis, JWT, CORS, AI, and Centrifugo config
- frontend uses `VITE_API_BASE_URL`
- websocket URL is exposed separately from backend API URL
- CORS should include local dev, Vercel domain, and any custom domain

## Scripts

### Frontend

```bash
npm run dev
npm run build
npm run preview
```

### Backend

```bash
./mvnw spring-boot:run
./mvnw test
./mvnw clean package
```

## Current State

Implemented areas include:

- authentication
- Google login support
- password reset flow
- profile/settings
- friends
- projects
- file upload and project memory
- solo chat flow
- collaborative environments
- collaborative AI sessions
- realtime streaming via Centrifugo
- landing page and app UI redesigns

## Notes

- local file storage currently uses `storage/` and `PROJECT_FILES_DIR`
- for long-term production durability, object storage is a better direction than container-local disk
- Redis is used both through Spring Redis and Redisson-based queue coordination

## License

No license has been added yet.

---

If you’re exploring the codebase for the first time, start with:

- `Sangam-frontend/src/App.tsx`
- `Sangam-backend/src/main/java/com/sangam/ai/SangamAiApplication.java`
- `Sangam-backend/src/main/resources/application.properties`
- `centrifugo/entrypoint.sh`
