# Docker Setup Guide

## Table of Contents

1. [What is Docker?](#what-is-docker)
2. [Why We Use Docker](#why-we-use-docker)
3. [Prerequisites](#prerequisites)
4. [Project Docker Structure](#project-docker-structure)
5. [Dockerfile Explained](#dockerfile-explained)
6. [Docker Compose Explained](#docker-compose-explained)
7. [Common Docker Commands](#common-docker-commands)
8. [Development Workflow](#development-workflow)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## What is Docker?

**Docker** is a platform that packages applications and their dependencies into **containers**—lightweight, portable units that run consistently across different environments.

### Think of it like this:

- **Without Docker**: You install Python, Flask, dependencies, MetaTrader 5, and configure everything manually on each machine. Different versions = different bugs.
- **With Docker**: You package everything into a "container" once. That container runs the same way on your laptop, your colleague's computer, and production servers.

### Key Concepts:

1. **Image**: A blueprint/template for a container (like a class in programming)
2. **Container**: A running instance of an image (like an object instance)
3. **Dockerfile**: Instructions to build an image
4. **Docker Compose**: Tool to run multiple containers together

---

## Why We Use Docker

Our Trading Alerts SaaS has two main components:

1. **Next.js application** (Frontend + Backend API) → Deployed to Vercel
2. **Flask MT5 microservice** (Python service for MetaTrader 5) → Deployed to Railway

### Why Docker for the Flask MT5 service?

| Problem                                                        | Docker Solution                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| **Python version conflicts**                                   | Docker locks Python 3.11 version                             |
| **MetaTrader 5 installation complexity**                       | Pre-installed in Docker image                                |
| **Dependency hell** (different developers, different packages) | All dependencies defined in requirements.txt, installed once |
| **"Works on my machine" syndrome**                             | Same container runs everywhere                               |
| **Easy deployment to Railway**                                 | Railway supports Docker out-of-the-box                       |
| **Isolation from Next.js**                                     | Flask runs in separate container, no conflicts               |

---

## Prerequisites

### Install Docker

1. **Download Docker Desktop**:
   - **Windows/Mac**: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
   - **Linux**: Follow [official Docker Engine installation](https://docs.docker.com/engine/install/)

2. **Verify installation**:

   ```bash
   docker --version
   docker-compose --version
   ```

   Expected output:

   ```
   Docker version 24.0.0 (or higher)
   Docker Compose version v2.20.0 (or higher)
   ```

3. **Start Docker Desktop** (Windows/Mac) or Docker daemon (Linux)

---

## Project Docker Structure

```
trading-alerts-saas-v7/
├── flask_mt5/                    # Flask microservice
│   ├── app.py                    # Main Flask application
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # Instructions to build Flask image
│   └── .dockerignore             # Files to exclude from image
├── docker-compose.yml            # Orchestrates all containers
└── .env                          # Environment variables
```

---

## Dockerfile Explained

### flask_mt5/Dockerfile

```dockerfile
# ============================================
# STAGE 1: Base Image
# ============================================
FROM python:3.11-slim

# What this does:
# - Uses official Python 3.11 image (slim = smaller size)
# - Slim variant includes only essential packages

# ============================================
# STAGE 2: Set Working Directory
# ============================================
WORKDIR /app

# What this does:
# - Creates /app directory inside container
# - All subsequent commands run from /app
# - Like running "cd /app" automatically

# ============================================
# STAGE 3: Install System Dependencies
# ============================================
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    wget \
    && rm -rf /var/lib/apt/lists/*

# What this does:
# - apt-get update: Updates package list
# - gcc/g++: C/C++ compilers (needed for MetaTrader5 Python package)
# - wget: Download tool
# - rm -rf /var/lib/apt/lists/*: Cleans up to reduce image size

# ============================================
# STAGE 4: Install MetaTrader 5 Terminal
# ============================================
RUN wget https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe \
    && chmod +x mt5setup.exe

# What this does:
# - Downloads MetaTrader 5 installer
# - Makes it executable
# - Note: For production, you may need Wine (Windows emulator) on Linux

# ============================================
# STAGE 5: Copy Requirements File
# ============================================
COPY requirements.txt .

# What this does:
# - Copies requirements.txt from host to /app in container
# - We copy this BEFORE copying all code for caching optimization
# - Docker caches layers; if requirements.txt unchanged, this layer reuses cache

# ============================================
# STAGE 6: Install Python Dependencies
# ============================================
RUN pip install --no-cache-dir -r requirements.txt

# What this does:
# - pip install: Installs all packages from requirements.txt
# - --no-cache-dir: Doesn't save pip cache (reduces image size)
# - Installs: Flask, MetaTrader5, pandas, etc.

# ============================================
# STAGE 7: Copy Application Code
# ============================================
COPY . .

# What this does:
# - Copies all files from flask_mt5/ to /app in container
# - Excludes files listed in .dockerignore
# - This layer rebuilds if ANY code changes

# ============================================
# STAGE 8: Expose Port
# ============================================
EXPOSE 5001

# What this does:
# - Documents that Flask runs on port 5001
# - Doesn't actually open the port (docker-compose does that)
# - Just metadata for developers

# ============================================
# STAGE 9: Set Environment Variables
# ============================================
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# What this does:
# - FLASK_APP: Tells Flask which file to run
# - FLASK_ENV: Sets production mode (no debug, optimized)
# - PYTHONUNBUFFERED: Ensures Python logs appear immediately

# ============================================
# STAGE 10: Health Check
# ============================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

# What this does:
# - Checks if Flask is healthy every 30 seconds
# - Calls /health endpoint (we'll implement this)
# - If 3 consecutive failures, marks container as unhealthy

# ============================================
# STAGE 11: Run Application
# ============================================
CMD ["python", "app.py"]

# What this does:
# - Runs "python app.py" when container starts
# - This starts the Flask server
# - Use CMD (not RUN) because this executes at runtime, not build time
```

### Why Each Layer Matters

**Layer Caching Optimization:**

```
Layer 1-4: System setup (rarely changes) ✓ Cached
Layer 5-6: Dependencies (changes occasionally) ✓ Cached if requirements.txt unchanged
Layer 7: Code (changes frequently) ✗ Rebuilds every time code changes
```

By copying `requirements.txt` before code, we avoid reinstalling all dependencies on every code change!

---

## Docker Compose Explained

### docker-compose.yml

```yaml
# ============================================
# Docker Compose Version
# ============================================
version: '3.8'

# What this does:
# - Specifies Docker Compose file format version
# - 3.8 is widely supported and feature-rich

# ============================================
# Services (Containers)
# ============================================
services:
  # ==========================================
  # PostgreSQL Database
  # ==========================================
  postgres:
    image: postgres:15-alpine
    # What this does:
    # - Uses official PostgreSQL 15 image (alpine = small size)

    container_name: trading_alerts_postgres
    # What this does:
    # - Names the container (easier to reference)

    restart: unless-stopped
    # What this does:
    # - Restarts container if it crashes
    # - unless-stopped: Won't restart if you manually stop it

    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    # What this does:
    # - Sets environment variables from .env file
    # - Creates database user, password, and database name

    ports:
      - '5432:5432'
    # What this does:
    # - Maps port 5432 on host to port 5432 in container
    # - Format: "host_port:container_port"
    # - Allows Next.js (on host) to connect to PostgreSQL (in container)

    volumes:
      - postgres_data:/var/lib/postgresql/data
    # What this does:
    # - Persists database data on host machine
    # - Even if container deleted, data survives
    # - postgres_data is a named volume (defined below)

    networks:
      - trading_alerts_network
    # What this does:
    # - Connects to custom network
    # - All services on same network can communicate

    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
    # What this does:
    # - Checks if PostgreSQL is ready every 10 seconds
    # - Other services can wait for this to be healthy

  # ==========================================
  # Flask MT5 Microservice
  # ==========================================
  flask_mt5:
    build:
      context: ./flask_mt5
      dockerfile: Dockerfile
    # What this does:
    # - Builds image from ./flask_mt5/Dockerfile
    # - context: Sets build context (files available during build)

    container_name: trading_alerts_flask

    restart: unless-stopped

    environment:
      FLASK_APP: app.py
      FLASK_ENV: ${FLASK_ENV:-production}
      MT5_LOGIN: ${MT5_LOGIN}
      MT5_PASSWORD: ${MT5_PASSWORD}
      MT5_SERVER: ${MT5_SERVER}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    # What this does:
    # - Sets Flask configuration
    # - FLASK_ENV: Uses .env value, defaults to "production"
    # - DATABASE_URL: Uses "postgres" as hostname (Docker DNS)

    ports:
      - '5001:5001'
    # What this does:
    # - Exposes Flask on http://localhost:5001

    volumes:
      - ./flask_mt5:/app
      - /app/__pycache__
    # What this does:
    # - Maps local ./flask_mt5 to /app in container (hot reload)
    # - Excludes __pycache__ (prevents conflicts)

    networks:
      - trading_alerts_network

    depends_on:
      postgres:
        condition: service_healthy
    # What this does:
    # - Waits for PostgreSQL to be healthy before starting Flask
    # - Prevents "database connection failed" errors on startup

    healthcheck:
      test:
        [
          'CMD',
          'wget',
          '--no-verbose',
          '--tries=1',
          '--spider',
          'http://localhost:5001/health',
        ]
      interval: 30s
      timeout: 10s
      retries: 3

# ============================================
# Networks
# ============================================
networks:
  trading_alerts_network:
    driver: bridge
# What this does:
# - Creates custom network for inter-container communication
# - bridge: Default Docker network driver
# - Services can ping each other by container name (e.g., "postgres")

# ============================================
# Volumes
# ============================================
volumes:
  postgres_data:
    driver: local
# What this does:
# - Creates named volume for persistent data
# - local: Stores on host filesystem
# - Data survives container deletion
```

### How Services Communicate

```
┌─────────────────┐
│   Next.js App   │  (runs on host, port 3000)
│  (not in Docker)│
└────────┬────────┘
         │
         │ HTTP requests
         ├─────────────────────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐           ┌─────────────────┐
│  PostgreSQL     │◄──────────┤   Flask MT5     │
│  (port 5432)    │  DATABASE_│  (port 5001)    │
└─────────────────┘     URL   └─────────────────┘
         ▲                             ▲
         │                             │
         └─────────────────────────────┘
          trading_alerts_network
```

---

## Common Docker Commands

### Build and Run

```bash
# Build all services
docker-compose build

# Start all services (detached mode)
docker-compose up -d

# Build and start together
docker-compose up -d --build

# Start specific service
docker-compose up flask_mt5
```

### Monitoring

```bash
# View running containers
docker-compose ps

# View logs (all services)
docker-compose logs

# View logs (specific service)
docker-compose logs flask_mt5

# Follow logs (real-time)
docker-compose logs -f flask_mt5

# View last 100 lines
docker-compose logs --tail=100 flask_mt5
```

### Managing Containers

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes database data!)
docker-compose down -v

# Restart specific service
docker-compose restart flask_mt5

# Rebuild specific service
docker-compose up -d --build flask_mt5
```

### Debugging

```bash
# Execute command in running container
docker-compose exec flask_mt5 bash

# Inside container, you can:
# - Check Python version: python --version
# - Test Flask: curl http://localhost:5001/health
# - View files: ls -la

# Run one-off command
docker-compose exec flask_mt5 python -c "import MetaTrader5; print(MetaTrader5.__version__)"

# View container resource usage
docker stats
```

### Cleanup

```bash
# Remove stopped containers
docker-compose rm

# Remove all unused images
docker image prune

# Remove all unused volumes
docker volume prune

# Nuclear option (⚠️ deletes everything!)
docker system prune -a --volumes
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/ripper7375/trading-alerts-saas-v7.git
cd trading-alerts-saas-v7

# 2. Create .env file
cp .env.example .env
# Edit .env with your credentials

# 3. Build and start Docker services
docker-compose up -d --build

# 4. Check health
docker-compose ps
# All services should show "healthy" status

# 5. View logs
docker-compose logs -f
```

### Daily Development

```bash
# Start services
docker-compose up -d

# Develop Next.js (runs on host)
npm run dev

# Make changes to Flask code
# Docker auto-reloads (thanks to volume mount)

# View Flask logs
docker-compose logs -f flask_mt5

# Stop services when done
docker-compose down
```

### Testing Changes

```bash
# Rebuild Flask service after dependency changes
docker-compose up -d --build flask_mt5

# Run migrations (if needed)
docker-compose exec flask_mt5 flask db upgrade

# Test endpoint
curl http://localhost:5001/api/mt5/account

# Check database
docker-compose exec postgres psql -U trading_alerts -d trading_alerts_db
```

---

## Troubleshooting

### Problem: Container won't start

```bash
# Check logs
docker-compose logs flask_mt5

# Common issues:
# - Port already in use: Change port in docker-compose.yml
# - Missing .env variables: Check .env file
# - Build failed: Run docker-compose build --no-cache
```

### Problem: "Cannot connect to database"

```bash
# Check PostgreSQL health
docker-compose ps postgres

# If unhealthy, check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection from Flask
docker-compose exec flask_mt5 python -c "
from sqlalchemy import create_engine
engine = create_engine('postgresql://trading_alerts:password@postgres:5432/trading_alerts_db')
print(engine.connect())
"
```

### Problem: Code changes not reflecting

```bash
# For Flask (should hot-reload):
# 1. Check volume mount in docker-compose.yml
# 2. Restart service: docker-compose restart flask_mt5

# For dependencies (requirements.txt changed):
docker-compose up -d --build flask_mt5
```

### Problem: Port already in use

```bash
# Find process using port 5001
lsof -i :5001  # Mac/Linux
netstat -ano | findstr :5001  # Windows

# Kill process or change port in docker-compose.yml
ports:
  - "5002:5001"  # Use port 5002 on host
```

### Problem: Out of disk space

```bash
# Check Docker disk usage
docker system df

# Clean up
docker system prune -a
docker volume prune
```

### Problem: Container keeps restarting

```bash
# Check logs for errors
docker-compose logs --tail=50 flask_mt5

# Check health status
docker inspect trading_alerts_flask | grep -A 10 Health

# Disable restart policy temporarily
# In docker-compose.yml, change:
restart: "no"
```

### Problem: MetaTrader 5 connection fails

```bash
# Verify MT5 credentials in .env
docker-compose exec flask_mt5 env | grep MT5

# Test MT5 connection
docker-compose exec flask_mt5 python -c "
import MetaTrader5 as mt5
mt5.initialize()
print(mt5.account_info())
mt5.shutdown()
"

# Common issues:
# - Wrong credentials
# - MT5 terminal not running
# - Firewall blocking connection
```

---

## Best Practices

### 1. Environment Variables

**Never commit .env to Git!**

```bash
# .gitignore should include:
.env
.env.local
.env.*.local
```

**Use .env.example as template:**

```bash
# .env.example (commit this)
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
MT5_LOGIN=your_mt5_login

# .env (DO NOT commit)
POSTGRES_USER=actual_user
POSTGRES_PASSWORD=actual_password_123
MT5_LOGIN=12345678
```

### 2. Image Size Optimization

```dockerfile
# ✓ Good: Use slim/alpine images
FROM python:3.11-slim

# ✗ Bad: Use full images (much larger)
FROM python:3.11

# ✓ Good: Clean up in same layer
RUN apt-get update && apt-get install -y gcc \
    && rm -rf /var/lib/apt/lists/*

# ✗ Bad: Clean up in separate layer (doesn't reduce size)
RUN apt-get update && apt-get install -y gcc
RUN rm -rf /var/lib/apt/lists/*
```

### 3. Layer Caching

```dockerfile
# ✓ Good: Copy dependencies first
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

# ✗ Bad: Copy everything first (cache invalidated on any code change)
COPY . .
RUN pip install -r requirements.txt
```

### 4. Security

```yaml
# ✓ Good: Use secrets for sensitive data
environment:
  DB_PASSWORD: ${DB_PASSWORD}  # From .env

# ✗ Bad: Hardcode secrets
environment:
  DB_PASSWORD: "my_secret_password"  # Never do this!

# ✓ Good: Run as non-root user
USER appuser

# ✗ Bad: Run as root (default)
# (no USER instruction)
```

### 5. Health Checks

```yaml
# ✓ Good: Implement health checks
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost:5001/health"]
  interval: 30s
  timeout: 10s
  retries: 3

# Implement /health endpoint in Flask:
@app.route('/health')
def health():
    return {'status': 'healthy'}, 200
```

### 6. Logging

```python
# ✓ Good: Use structured logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info('MT5 connection established', extra={'account': account_id})

# ✗ Bad: Use print statements
print('MT5 connection established')
```

### 7. Development vs Production

```yaml
# Use separate docker-compose files
# docker-compose.yml (production)
# docker-compose.dev.yml (development)

# Development overrides:
services:
  flask_mt5:
    environment:
      FLASK_ENV: development
    volumes:
      - ./flask_mt5:/app  # Hot reload

# Run development setup:
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Deployment to Railway

Railway supports Docker deployments out-of-the-box.

### Steps:

1. **Push code to GitHub**:

   ```bash
   git add flask_mt5/
   git commit -m "feat: add Flask MT5 Docker setup"
   git push origin main
   ```

2. **Connect Railway to GitHub**:
   - Go to [Railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `trading-alerts-saas-v7`

3. **Railway auto-detects Dockerfile**:
   - Railway finds `flask_mt5/Dockerfile`
   - Builds image automatically
   - Exposes port 5001

4. **Set environment variables in Railway**:
   - Go to project → Variables
   - Add all .env variables (FLASK_ENV, MT5_LOGIN, etc.)

5. **Deploy**:
   - Railway deploys on every push to main
   - Provides public URL: `https://your-service.railway.app`

### Railway-specific Dockerfile adjustments:

```dockerfile
# Use Railway's PORT environment variable
ENV PORT=${PORT:-5001}

# Bind to 0.0.0.0 (Railway requires this)
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=${PORT}"]
```

---

## Summary

**Docker in this project**:

- **PostgreSQL**: Database container for development
- **Flask MT5**: Python microservice for MetaTrader 5 integration
- **Docker Compose**: Orchestrates both containers

**Key benefits**:

- ✅ Consistent development environment
- ✅ Easy deployment to Railway
- ✅ Isolated Flask service
- ✅ Simple setup (one command: `docker-compose up`)

**Next steps**:

1. Review `flask_mt5/Dockerfile`
2. Review `docker-compose.yml`
3. Run `docker-compose up -d --build`
4. Test Flask: `curl http://localhost:5001/health`
5. Check logs: `docker-compose logs -f`

For more details, see:

- **ARCHITECTURE.md**: System design overview
- **docs/policies/03-architecture-rules.md**: Flask MT5 integration patterns
- **docs/policies/05-coding-patterns.md**: Flask endpoint examples
