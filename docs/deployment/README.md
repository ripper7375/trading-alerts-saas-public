# Deployment Documentation Index

**Last Updated:** 2026-01-14
**Project:** Trading Alerts SaaS
**Purpose:** Master index for all deployment guides and procedures

---

## 📋 Overview

This directory contains all deployment documentation for the Trading Alerts SaaS system. The system uses a **dual-architecture approach** with Part 6 (Flask MT5 Service) and Part 20 (SQLite-Sync Script) working in parallel.

---

## 🎯 Quick Navigation

### Production Deployment

| Component | Document | Status | Environment |
|-----------|----------|--------|-------------|
| **Part 6: Flask MT5 Service** | [contabo-windows-setup.md](./contabo-windows-setup.md) | ✅ **PRODUCTION** - SINGLE SOURCE OF TRUTH | Contabo Windows VPS |
| **Part 20: SQLite-Sync Script** | See [PART6-PART20-DUAL-SYSTEM.md](../architecture/PART6-PART20-DUAL-SYSTEM.md) | ✅ **PRODUCTION** | Contabo Windows VPS |

### Emergency Procedures

| Procedure | Document | Status | When to Use |
|-----------|----------|--------|-------------|
| **Emergency Rollback to Part 6** | [rollback-to-part6.md](../migration/rollback-to-part6.md) | ⚠️ **EMERGENCY ONLY** | Part 20 has critical issues |

### Architecture Documentation

| Topic | Document | Status |
|-------|----------|--------|
| **Dual-System Architecture** | [PART6-PART20-DUAL-SYSTEM.md](../architecture/PART6-PART20-DUAL-SYSTEM.md) | ✅ **CURRENT** |
| **WebSocket Implementation** | See Part 6 deployment guide | ✅ **CURRENT** |

---

## 🚀 Deployment Guides

### Part 6: Flask MT5 Service (Windows Native)

**📄 Document:** [contabo-windows-setup.md](./contabo-windows-setup.md)
**Status:** ✅ **PRODUCTION** - **SINGLE SOURCE OF TRUTH**
**Environment:** Contabo Windows VPS (Native Windows deployment)

#### What It Does:
- Real-time MT5 data streaming via WebSocket
- Direct access to 15 MT5 terminals
- Custom indicator processing
- WebSocket server for Next.js frontend
- Runs as Windows Service (NSSM)

#### Key Features:
- ✅ WebSocket support (Socket.IO)
- ✅ Windows Service installation (NSSM)
- ✅ Automated PowerShell setup scripts
- ✅ Native Windows deployment (NO Docker)
- ✅ Real-time data updates (1-second intervals)

#### Quick Start:
```powershell
# On Contabo Windows VPS
cd C:\trading-alerts\mt5-service\deploy

# Run automated setup
.\windows-setup.ps1

# Install as Windows Service
.\windows-install-service.ps1
```

#### Important Notes:
- ❌ **Docker NOT supported** - MT5 requires native Windows
- ✅ **WebSocket recommended** for real-time data
- ✅ **Automated setup scripts** available

---

### Part 20: SQLite-Sync Script

**📄 Document:** See [PART6-PART20-DUAL-SYSTEM.md](../architecture/PART6-PART20-DUAL-SYSTEM.md)
**Status:** ✅ **PRODUCTION**
**Environment:** Contabo Windows VPS

#### What It Does:
- Syncs MT5 data to SQLite database
- Periodic data persistence
- Historical data storage
- Complements Part 6 real-time streaming

#### Relationship with Part 6:
Part 6 and Part 20 work **in parallel**:
- **Part 6:** Real-time WebSocket data for live charts
- **Part 20:** Historical data persistence for analysis

See architecture documentation for detailed explanation.

---

## ⚠️ Emergency Procedures

### Emergency Rollback to Part 6

**📄 Document:** [rollback-to-part6.md](../migration/rollback-to-part6.md)
**Status:** ⚠️ **EMERGENCY ONLY**

#### When to Use:
- ❌ Error rate > 5% for 10+ minutes
- ❌ Data sync failing for 5+ minutes
- ❌ Chart accuracy issues affecting trading
- ❌ Database connection failures

#### Quick Rollback:
```powershell
# On Contabo Windows VPS
cd C:\trading-alerts\mt5-service\deploy

# Run automated rollback
.\windows-setup.ps1
.\windows-install-service.ps1
```

#### Prerequisites:
- ✅ Part 6 code in repository (restored)
- ✅ MT5 terminals running
- ✅ Python 3.9+ installed
- ✅ PowerShell access to Contabo

---

## 🏗️ Architecture Documentation

### Dual-System Architecture

**📄 Document:** [PART6-PART20-DUAL-SYSTEM.md](../architecture/PART6-PART20-DUAL-SYSTEM.md)
**Status:** ✅ **CURRENT**

#### Key Concepts:
- **Part 6 (Flask MT5):** Real-time WebSocket streaming
- **Part 20 (SQLite-Sync):** Historical data persistence
- **Hybrid Mode:** Feature flag switching (`USE_FLASK_MT5`)
- **Communication:** WebSocket (Part 6) vs HTTP/JSON (Part 20)

#### Architecture Diagrams:
- Data flow diagrams
- WebSocket event architecture
- Deployment models

---

## 📚 Related Documentation

### Deployment Scripts

| Script | Purpose | Location |
|--------|---------|----------|
| `windows-setup.ps1` | Automated Windows setup | `mt5-service/deploy/` |
| `windows-install-service.ps1` | Windows Service installation | `mt5-service/deploy/` |

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `.env.example` | Environment variables template | Root directory |
| `docker-compose.yml` | **LOCAL DEV ONLY** (not for production) | Root directory |

### Migration Documentation

| Document | Status | Purpose |
|----------|--------|---------|
| [rollback-to-part6.md](../migration/rollback-to-part6.md) | ⚠️ EMERGENCY | Rollback procedure |

---

## 🎨 Status Labels Guide

This documentation uses the following status labels:

| Label | Meaning | Usage |
|-------|---------|-------|
| ✅ **PRODUCTION** | Currently in production use | Active deployment guides |
| ✅ **CURRENT** | Up-to-date documentation | Current architecture docs |
| ⚠️ **EMERGENCY ONLY** | Use only in emergencies | Rollback procedures |
| 🔄 **LOCAL DEV ONLY** | Development use only | Docker configurations |
| 📦 **ARCHIVED** | No longer in use | Historical reference |

---

## ⚙️ Environment-Specific Deployment

### Contabo Windows VPS (Production)

**Components:**
1. **Flask MT5 Service (Part 6)** - Native Windows deployment
2. **SQLite-Sync Script (Part 20)** - Windows scheduled task/service
3. **MT5 Terminals (15x)** - Windows native applications

**Deployment Method:**
- ✅ PowerShell automation scripts
- ✅ Windows Service (NSSM)
- ✅ Native Windows execution
- ❌ NO Docker

**Port Configuration:**
- Port 5001: Flask MT5 WebSocket service

---

### Vercel (Next.js Frontend)

**Environment Variables Required:**
```env
# For Part 6 (WebSocket)
USE_FLASK_MT5=true
NEXT_PUBLIC_MT5_WS_URL=ws://contabo-ip:5001

# For Part 20 (HTTP/JSON)
USE_FLASK_MT5=false
# Uses Next.js API routes with Prisma
```

---

## 🔍 Troubleshooting

### Common Issues

| Issue | Document | Section |
|-------|----------|---------|
| Flask service won't start | [contabo-windows-setup.md](./contabo-windows-setup.md) | Troubleshooting |
| WebSocket not connecting | [contabo-windows-setup.md](./contabo-windows-setup.md) | Troubleshooting |
| MT5 terminals not accessible | [contabo-windows-setup.md](./contabo-windows-setup.md) | Troubleshooting |
| Service installation fails | [contabo-windows-setup.md](./contabo-windows-setup.md) | Manual Setup |

---

## 📞 Support and Maintenance

### Documentation Maintenance

- **Last Updated:** 2026-01-14
- **Maintained By:** Development Team
- **Review Schedule:** Monthly or after major deployments

### Update Procedure

When updating deployment documentation:

1. Update the specific guide (e.g., contabo-windows-setup.md)
2. Update this index if structure changes
3. Update architecture documentation if flow changes
4. Update Last Updated date
5. Commit with descriptive message

---

## ✅ Deployment Checklist

### Before Production Deployment

- [ ] Read [contabo-windows-setup.md](./contabo-windows-setup.md)
- [ ] Verify Windows Server prerequisites
- [ ] Verify Python 3.9+ installed
- [ ] Verify MT5 terminals running and configured
- [ ] Review [PART6-PART20-DUAL-SYSTEM.md](../architecture/PART6-PART20-DUAL-SYSTEM.md)
- [ ] Configure `.env` with production credentials
- [ ] Test WebSocket connection from frontend
- [ ] Verify Windows Firewall rules (port 5001)

### After Production Deployment

- [ ] Monitor Flask service logs
- [ ] Test WebSocket connection from Next.js frontend
- [ ] Verify MT5 terminal connections (all 15)
- [ ] Test real-time data updates
- [ ] Configure monitoring/alerts
- [ ] Document any deployment issues

---

## 🔗 External References

- **NSSM (Non-Sucking Service Manager):** https://nssm.cc/
- **Python Downloads:** https://www.python.org/downloads/windows/
- **MetaTrader 5:** https://www.metatrader5.com/
- **Flask-SocketIO:** https://flask-socketio.readthedocs.io/
- **Socket.IO Client:** https://socket.io/docs/v4/client-api/

---

**Last Updated:** 2026-01-14
**Version:** 1.0.0
**Maintained By:** Development Team
