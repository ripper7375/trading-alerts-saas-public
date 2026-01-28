# Docker Deployment Guide

## Complete Guide for Local Development and Production Deployment

---

## 🎯 Overview

This project uses **two different Docker configurations**:

| Configuration            | Purpose           | Where         | Database             | Redis                  | API                 |
| ------------------------ | ----------------- | ------------- | -------------------- | ---------------------- | ------------------- |
| **`docker-compose.yml`** | Local Development | Your Computer | ✅ localhost:5432    | ✅ localhost:6379      | ✅ localhost:3001   |
| **`Dockerfile`**         | Production        | Railway/Cloud | ❌ Cloud TimescaleDB | ❌ Cloud Upstash Redis | ✅ Cloud deployment |

---

## 🏠 Scenario 1: Local Development (Localhost)

### **What You're Running:**

- PostgreSQL with TimescaleDB (localhost:5432)
- Redis (localhost:6379)
- Nest.js API (localhost:3001)
- pgAdmin (localhost:5050) - Optional
- Redis Commander (localhost:8081) - Optional

### **Prerequisites:**

```bash
# Install Docker Desktop
# Windows: https://docs.docker.com/desktop/install/windows-install/
# Mac: https://docs.docker.com/desktop/install/mac-install/
# Linux: https://docs.docker.com/engine/install/

# Verify installation
docker --version
docker-compose --version
```

---

### **Step-by-Step Setup:**

#### **Step 1: Create Project Structure**

```bash
nest-api/
├── docker-compose.yml           # ← Main file for local dev
├── Dockerfile.dev               # ← Development Dockerfile
├── Dockerfile                   # ← Production Dockerfile
├── docker/
│   └── init-db.sql             # ← Database initialization
├── .env.local                   # ← Local environment variables
├── src/                         # ← Your Nest.js code
├── prisma/
│   └── schema.prisma
└── package.json
```

#### **Step 2: Create `.env.local` File**

```bash
# .env.local - For LOCAL DEVELOPMENT

# Database (local Docker container)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trading_db

# Redis (local Docker container)
REDIS_URL=redis://localhost:6379

# MT5 Flask Service (your Contabo VPS)
MT5_FLASK_WS_URL=ws://your-contabo-ip:5000

# JWT
JWT_SECRET=local-dev-secret-change-in-production
JWT_EXPIRATION=7d

# Frontend (local Next.js)
FRONTEND_URL=http://localhost:3000

# Application
NODE_ENV=development
PORT=3001

# Caching
CACHE_TTL_OHLCV=3600
CACHE_TTL_INDICATORS=360

# Features
ENABLE_COMPRESSION=true
ENABLE_CORS=true
```

#### **Step 3: Start All Services**

```bash
# Start all containers (PostgreSQL, Redis, API, pgAdmin, Redis Commander)
docker-compose up -d

# Check status
docker-compose ps

# Expected output:
# NAME                   STATUS    PORTS
# trading-postgres       Up        0.0.0.0:5432->5432/tcp
# trading-redis          Up        0.0.0.0:6379->6379/tcp
# trading-api            Up        0.0.0.0:3001->3001/tcp
# trading-pgadmin        Up        0.0.0.0:5050->80/tcp
# trading-redis-commander Up       0.0.0.0:8081->8081/tcp
```

#### **Step 4: Verify Services**

**PostgreSQL (TimescaleDB):**

```bash
# Connect to PostgreSQL
docker exec -it trading-postgres psql -U postgres -d trading_db

# Check tables
\dt

# Check if TimescaleDB is enabled
SELECT * FROM timescaledb_information.hypertables;

# Exit
\q
```

**Redis:**

```bash
# Connect to Redis
docker exec -it trading-redis redis-cli

# Test Redis
ping
# Should return: PONG

# Check keys
KEYS *

# Exit
exit
```

**Nest.js API:**

```bash
# Check logs
docker-compose logs -f api

# Test API
curl http://localhost:3001/health

# Expected: {"status":"ok","uptime":12345}
```

**pgAdmin (Database UI):**

- Open: http://localhost:5050
- Login: admin@trading.com / admin
- Add server: postgres / postgres / trading_db

**Redis Commander (Redis UI):**

- Open: http://localhost:8081
- View cache keys and values

#### **Step 5: Development Workflow**

**Hot-Reload is ENABLED:**

```bash
# Any changes to src/ will trigger automatic restart
# No need to rebuild containers

# Edit your code
nano src/websocket/websocket.gateway.ts

# Save file → API automatically restarts (watch logs)
docker-compose logs -f api
```

**Run Prisma Migrations:**

```bash
# Generate Prisma Client
docker-compose exec api npx prisma generate

# Run migrations
docker-compose exec api npx prisma migrate dev

# Prisma Studio (Database UI)
docker-compose exec api npx prisma studio
```

**Stop Everything:**

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (delete all data)
docker-compose down -v
```

---

### **Common Local Development Commands:**

```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f api

# Restart specific service
docker-compose restart api

# Rebuild API after package.json changes
docker-compose up -d --build api

# Execute command in container
docker-compose exec api npm test

# Open shell in container
docker-compose exec api sh

# Check resource usage
docker stats
```

---

## 🚀 Scenario 2: Production Deployment (Railway/Cloud)

### **What You're Using:**

- Cloud TimescaleDB (Timescale Cloud or Railway PostgreSQL)
- Cloud Redis (Upstash)
- Railway for Nest.js API deployment

### **Prerequisites:**

```bash
# Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

---

### **Step-by-Step Deployment:**

#### **Step 1: Create Railway Project**

```bash
# Initialize Railway project
railway init

# Link to existing project (if already created)
railway link
```

#### **Step 2: Create `.env.production` File**

```bash
# .env.production - For RAILWAY DEPLOYMENT

# Database (Railway PostgreSQL or Timescale Cloud)
DATABASE_URL=postgresql://user:password@railway.app:5432/trading_db

# Redis (Upstash)
REDIS_URL=redis://default:password@upstash.io:6379

# MT5 Flask Service (Contabo VPS)
MT5_FLASK_WS_URL=ws://your-contabo-ip:5000

# JWT (use strong secret!)
JWT_SECRET=super-secret-production-key-change-this
JWT_EXPIRATION=7d

# Frontend (Vercel)
FRONTEND_URL=https://tradingalerts.vercel.app

# Application
NODE_ENV=production
PORT=3001

# Caching
CACHE_TTL_OHLCV=3600
CACHE_TTL_INDICATORS=360

# Features
ENABLE_COMPRESSION=true
ENABLE_CORS=true
```

#### **Step 3: Create `railway.json` Config**

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/main.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### **Step 4: Deploy to Railway**

**Option A: Railway CLI**

```bash
# Deploy from local
railway up

# Check deployment status
railway status

# View logs
railway logs

# Open deployed app
railway open
```

**Option B: GitHub Integration**

```bash
# Push to GitHub
git add .
git commit -m "Deploy to Railway"
git push origin main

# Railway auto-deploys from GitHub (if connected)
```

#### **Step 5: Set Environment Variables**

**Via Railway Dashboard:**

1. Go to Railway dashboard
2. Select your project
3. Go to "Variables" tab
4. Add all variables from `.env.production`

**Via Railway CLI:**

```bash
# Set variables one by one
railway variables set DATABASE_URL="postgresql://..."
railway variables set REDIS_URL="redis://..."
railway variables set JWT_SECRET="..."

# Or import from file
railway variables set --from .env.production
```

#### **Step 6: Run Database Migrations**

```bash
# Run Prisma migrations on Railway
railway run npx prisma migrate deploy

# Generate Prisma Client
railway run npx prisma generate
```

#### **Step 7: Verify Deployment**

```bash
# Get deployment URL
railway domain

# Test health endpoint
curl https://your-app.railway.app/health

# Test WebSocket (from frontend)
# Connect to: wss://your-app.railway.app
```

---

## 📊 Comparison: Local vs Production

| Aspect               | Local Development                  | Production (Railway)           |
| -------------------- | ---------------------------------- | ------------------------------ |
| **Database**         | Docker PostgreSQL (localhost:5432) | Railway/Timescale Cloud        |
| **Redis**            | Docker Redis (localhost:6379)      | Upstash Redis                  |
| **API**              | Docker Nest.js (localhost:3001)    | Railway (cloud URL)            |
| **Hot-Reload**       | ✅ Enabled (Dockerfile.dev)        | ❌ Disabled (production build) |
| **Data Persistence** | Docker volumes (lost on -v)        | Cloud (persistent)             |
| **Environment**      | .env.local                         | Railway variables              |
| **Build Time**       | Slower (includes dev deps)         | Faster (production only)       |
| **Image Size**       | ~500MB (with dev deps)             | ~200MB (optimized)             |
| **Security**         | Relaxed (for testing)              | Strict (production)            |
| **Debugging**        | Easy (hot-reload, logs)            | Harder (cloud logs)            |

---

## 🔧 Troubleshooting

### **Local Development Issues:**

**Problem: "Port already in use"**

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3002:3001"  # Use 3002 instead
```

**Problem: "Cannot connect to PostgreSQL"**

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

**Problem: "Hot-reload not working"**

```bash
# Rebuild containers
docker-compose down
docker-compose up -d --build

# Check if volumes are mounted correctly
docker-compose config
```

**Problem: "Database not initialized"**

```bash
# Remove volumes and restart
docker-compose down -v
docker-compose up -d

# Manually run init script
docker exec -it trading-postgres psql -U postgres -d trading_db -f /docker-entrypoint-initdb.d/init-db.sql
```

---

### **Production Deployment Issues:**

**Problem: "Build fails on Railway"**

```bash
# Check Railway logs
railway logs

# Test build locally
docker build -t nest-api .
docker run -p 3001:3001 nest-api

# Check Dockerfile syntax
docker build --no-cache -t nest-api .
```

**Problem: "Database connection fails"**

```bash
# Verify DATABASE_URL
railway variables

# Test connection
railway run npx prisma db pull

# Check TimescaleDB extension
railway connect postgres
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

**Problem: "WebSocket not connecting"**

```bash
# Check CORS settings
FRONTEND_URL=https://your-frontend.vercel.app

# Check Railway domain
railway domain

# Test WebSocket connection
wscat -c wss://your-app.railway.app
```

---

## 🎯 Best Practices

### **For Local Development:**

1. ✅ Use `docker-compose.yml` for full stack
2. ✅ Mount source code as volume for hot-reload
3. ✅ Use `.env.local` for configuration
4. ✅ Use pgAdmin for database inspection
5. ✅ Use Redis Commander for cache inspection
6. ✅ Keep docker-compose up during development
7. ✅ Use `docker-compose down -v` to reset data

### **For Production:**

1. ✅ Use multi-stage `Dockerfile` for smaller images
2. ✅ Use Railway environment variables (not .env files)
3. ✅ Enable health checks
4. ✅ Use non-root user in container
5. ✅ Enable compression for hypertables
6. ✅ Set up monitoring and logging
7. ✅ Use strong JWT secrets
8. ✅ Enable CORS only for specific origins

---

## 📦 Complete Setup Commands

### **Local Development (One-Time Setup):**

```bash
# 1. Clone repository
git clone <your-repo>
cd nest-api

# 2. Create environment file
cp .env.example .env.local

# 3. Start Docker containers
docker-compose up -d

# 4. Wait for services to be healthy
docker-compose ps

# 5. Check logs
docker-compose logs -f

# 6. Access services
# API: http://localhost:3001
# PostgreSQL: localhost:5432
# Redis: localhost:6379
# pgAdmin: http://localhost:5050
# Redis Commander: http://localhost:8081

# 7. Run migrations
docker-compose exec api npx prisma migrate dev

# 8. Generate Prisma Client
docker-compose exec api npx prisma generate

# 9. Seed database (if needed)
docker-compose exec api npm run seed

# Done! Start coding 🎉
```

### **Production Deployment (Railway):**

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project
railway init

# 4. Set environment variables
railway variables set --from .env.production

# 5. Deploy
railway up

# 6. Run migrations
railway run npx prisma migrate deploy

# 7. Check status
railway status

# 8. View logs
railway logs -f

# Done! API is live 🚀
```

---

## 📚 Additional Resources

- **Docker Documentation:** https://docs.docker.com
- **Docker Compose Documentation:** https://docs.docker.com/compose
- **Railway Documentation:** https://docs.railway.app
- **TimescaleDB Documentation:** https://docs.timescale.com
- **Nest.js Docker Guide:** https://docs.nestjs.com/recipes/docker

---

**Guide Version:** 1.0  
**Last Updated:** January 15, 2026  
**Status:** Complete and Ready to Use ✅
