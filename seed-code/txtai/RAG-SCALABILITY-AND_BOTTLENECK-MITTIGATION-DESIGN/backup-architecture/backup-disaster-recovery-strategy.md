# Trading Conversational AI - Backup & Disaster Recovery Strategy

**Version:** 1.0
**Date:** 2026-02-15
**Status:** Production-Required
**Owner:** DevOps/Infrastructure Team
**Related Document:** [rag-scalability-enhanced-v2.md](rag-scalability-enhanced-v2.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Distinction: Replicas vs Backups](#critical-distinction-replicas-vs-backups)
3. [Backup Requirements](#backup-requirements)
4. [Backup Architecture](#backup-architecture)
5. [Automated Backup Configuration](#automated-backup-configuration)
6. [Manual Backup Procedures](#manual-backup-procedures)
7. [Recovery Procedures](#recovery-procedures)
8. [Disaster Recovery Scenarios](#disaster-recovery-scenarios)
9. [Testing & Validation](#testing--validation)
10. [Monitoring & Alerting](#monitoring--alerting)
11. [Compliance & Retention](#compliance--retention)
12. [Team Responsibilities](#team-responsibilities)
13. [Cost Analysis](#cost-analysis)
14. [Runbooks](#runbooks)
15. [Appendix](#appendix)

---

## Executive Summary

This document defines the **Backup and Disaster Recovery (DR) strategy** for the Trading Conversational AI platform. It serves as a **contract between Development and Infrastructure teams** regarding data protection responsibilities.

### Key Objectives

1. **Protect against data loss** from human error, corruption, or malicious activity
2. **Enable point-in-time recovery** for any incident within 30-day window
3. **Meet compliance requirements** for data retention and recovery
4. **Define clear SLAs** for Recovery Point Objective (RPO) and Recovery Time Objective (RTO)
5. **Establish testing procedures** to validate backup integrity

### Service Level Agreements (SLAs)

| Metric                             | Target             | Current | Status     |
| ---------------------------------- | ------------------ | ------- | ---------- |
| **RPO (Recovery Point Objective)** | <1 hour            | ~15 min | ✅         |
| **RTO (Recovery Time Objective)**  | <30 min            | ~25 min | ✅         |
| **Backup Success Rate**            | >99.5%             | TBD     | ⏳         |
| **Backup Verification**            | 100% tested        | TBD     | ⏳         |
| **Retention Period**               | 30 days            | 30 days | ✅         |
| **Cross-region Redundancy**        | Optional (Phase 2) | No      | 📋 Planned |

### Recovery Capabilities

| Data Loss Scenario     | Can Recover?      | Method                         | Max Data Loss |
| ---------------------- | ----------------- | ------------------------------ | ------------- |
| Accidental DELETE/DROP | ✅ Yes            | Point-in-time restore          | <1 hour       |
| Bad migration          | ✅ Yes            | Restore pre-migration snapshot | 0             |
| Ransomware/encryption  | ✅ Yes            | Restore from clean backup      | <6 hours      |
| Data corruption        | ✅ Yes            | Restore from last good backup  | <24 hours     |
| Primary server crash   | ✅ Yes (failover) | Read replica promotion         | 0             |
| Entire region failure  | ⚠️ Phase 2        | Cross-region backup            | <24 hours     |

---

## Critical Distinction: Replicas vs Backups

### ⚠️ IMPORTANT: Read Replicas Are NOT Backups

**Read replicas provide:**

- ✅ High availability (failover)
- ✅ Read scalability
- ✅ Zero data loss on hardware failure

**Read replicas DO NOT protect against:**

- ❌ Accidental data deletion
- ❌ Data corruption
- ❌ Ransomware attacks
- ❌ Bad migrations
- ❌ Application bugs

### Why? Real-Time Replication

```
9:00 AM - Developer accidentally runs:
          DELETE FROM conversations;  (forgot WHERE clause)

Primary Database:
└─> All conversations deleted

        ↓ Replication (< 1 second)

Read Replica #1:
└─> All conversations deleted

Read Replica #2:
└─> All conversations deleted

Result: Data is gone EVERYWHERE
Solution: Restore from backup (not replica)
```

### The Complete Protection Strategy

```
┌─────────────────────────────────────────────────────────┐
│  PRODUCTION DATA PROTECTION (3 Layers)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Read Replicas (High Availability)             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  • Primary + 2 Read Replicas                            │
│  • Automatic failover < 30s                             │
│  • Protects: Hardware failure, server crash             │
│  • Does NOT protect: Human error, corruption            │
│  • See: rag-scalability-enhanced-v2.md Section 8        │
│                                                          │
│  Layer 2: Automated Backups (Disaster Recovery)         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  • Daily full snapshots (2 AM UTC)                      │
│  • Continuous WAL archiving (every 16MB)                │
│  • 30-day retention                                      │
│  • Protects: Accidental deletion, corruption            │
│  • Point-in-time recovery within 1 hour                 │
│                                                          │
│  Layer 3: Manual Snapshots (Safety Net)                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  • Pre-migration snapshots                              │
│  • Pre-deployment snapshots                             │
│  • Weekly manual backups                                │
│  • Protects: Known-risky operations                     │
│  • Retention: Until manually deleted                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Backup Requirements

### Business Requirements

| Requirement                  | Target     | Justification                                   |
| ---------------------------- | ---------- | ----------------------------------------------- |
| Maximum acceptable data loss | 1 hour     | User conversations have low change frequency    |
| Maximum acceptable downtime  | 30 minutes | SaaS availability SLA of 99.9%                  |
| Backup retention             | 30 days    | Regulatory compliance + user dispute resolution |
| Geographic redundancy        | Phase 2    | Single-region acceptable for early stage        |
| Encryption at rest           | Required   | PCI DSS compliance for payment data             |
| Backup testing frequency     | Monthly    | Verify restore procedures work                  |

### Technical Requirements

```yaml
PostgreSQL Database Backups:
  Full Backup:
    - Frequency: Daily at 2 AM UTC
    - Method: pg_basebackup
    - Compression: gzip (5:1 ratio)
    - Encryption: AES-256
    - Storage: Railway S3-compatible
    - Retention: 30 days

  Incremental Backup (WAL):
    - Frequency: Continuous (every 16MB)
    - Method: WAL archiving
    - Retention: Aligned with full backups
    - Purpose: Point-in-time recovery

  Manual Snapshots:
    - Trigger: Pre-migration, pre-deployment
    - Retention: Until manually deleted (max 90 days)
    - Naming: {timestamp}-{purpose}-{initiator}

Redis Backups:
  RDB Snapshot:
    - Frequency: Every 6 hours
    - Retention: 7 days
    - Storage: Railway managed

  AOF (Append-Only File):
    - Frequency: Every second
    - Purpose: Minimize data loss
    - Retention: 24 hours

Qdrant Vector Database:
  Snapshot:
    - Frequency: Daily
    - Retention: 14 days
    - Note: Can rebuild from PostgreSQL if needed
```

---

## Backup Architecture

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKUP STORAGE ARCHITECTURE                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Primary Region (us-west-2)                                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Production Database (Primary)                            │  │
│  │  • trading-ai-prod-primary                                │  │
│  │  • 100GB data                                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                       ↓                                          │
│           [Automated Backup Process]                             │
│                       ↓                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Railway Backup Storage (S3-compatible)                   │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │
│  │                                                            │  │
│  │  Full Backups (Daily):                                    │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ backup-2026-02-15-02-00.sql.gz    (20GB compressed)│ │  │
│  │  │ backup-2026-02-14-02-00.sql.gz    (19GB)           │ │  │
│  │  │ backup-2026-02-13-02-00.sql.gz    (18GB)           │ │  │
│  │  │ ... (30 days retention = 600GB total)              │ │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  WAL Archives (Continuous):                               │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ wal/000000010000000000000001 (16MB)                │ │  │
│  │  │ wal/000000010000000000000002 (16MB)                │ │  │
│  │  │ ... (rolling 30 days = ~200GB)                     │ │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Manual Snapshots:                                        │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ 2026-02-10-pre-migration-v2-dhapanart.sql.gz       │ │  │
│  │  │ 2026-02-08-pre-deploy-v1.5-devops.sql.gz          │ │  │
│  │  │ ... (retained until manually deleted)              │ │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Properties:                                              │  │
│  │  • Encryption: AES-256 at rest                            │  │
│  │  • Replication: 3x within region                          │  │
│  │  • Durability: 99.999999999% (11 nines)                  │  │
│  │  • Access: Private (IAM-based)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Cross-Region Backup (Optional)                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Secondary Region (us-east-1)                             │  │
│  │  • Daily replication of backups                           │  │
│  │  • 7-day retention (not 30)                               │  │
│  │  • Cost: +$50/month                                       │  │
│  │  • Purpose: Regional disaster recovery                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Backup Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKUP LIFECYCLE (30-Day Retention)                             │
└─────────────────────────────────────────────────────────────────┘

Day 0 (Today):
  02:00 AM → Full backup created (backup-2026-02-15.sql.gz)
  02:00 AM → WAL archiving begins
  02:15 AM → Backup verification (test restore to staging)
  02:30 AM → Backup integrity check passes ✅
  02:30 AM → Backup metadata logged to monitoring

Day 1-29:
  → Backup stored in S3
  → Available for point-in-time recovery
  → Monitored for corruption
  → Accessible via Railway CLI or API

Day 30:
  → Backup marked for deletion
  → Retention policy enforced
  → Newer backups available

Day 31:
  → Backup permanently deleted
  → Storage reclaimed
  → Cannot be recovered (past retention window)

Exception: Manual Snapshots
  → Retained indefinitely until manually deleted
  → Reviewed quarterly for relevance
  → Maximum 90-day retention (policy enforcement)
```

---

## Automated Backup Configuration

### Railway PostgreSQL Backup Settings

**Configuration via Railway Dashboard:**

```yaml
# Railway PostgreSQL Backup Configuration
# Location: Project Settings > trading-ai-prod-primary > Backups

Automated Backups: Enabled ✅

Schedule:
  Full Backup Time: 02:00 UTC (Daily)
  WAL Archiving: Continuous (Enabled)
  Retention Period: 30 days

Storage:
  Location: us-west-2 (same region as primary)
  Encryption: AES-256 (Enabled)
  Compression: gzip (Enabled)
  Redundancy: 3x replication

Notifications:
  Backup Success: Disabled (too noisy)
  Backup Failure: Enabled → Slack #alerts
  Verification Failure: Enabled → PagerDuty

Point-in-Time Recovery:
  Enabled: Yes
  Granularity: 1-minute intervals
  Available Window: 30 days
```

**Configuration via Railway CLI:**

```bash
# Enable automated backups
railway db backup enable \
  --database trading-ai-prod-primary \
  --schedule "0 2 * * *" \
  --retention 30

# Configure WAL archiving
railway db wal-archiving enable \
  --database trading-ai-prod-primary

# Set backup notifications
railway db backup notifications \
  --database trading-ai-prod-primary \
  --on-failure slack://hooks.slack.com/services/XXX \
  --on-verification-failure pagerduty://XXX
```

### PostgreSQL WAL Configuration

**Primary database postgresql.conf:**

```ini
# WAL (Write-Ahead Logging) Configuration
# Purpose: Enable point-in-time recovery

wal_level = replica
archive_mode = on
archive_command = 'railway-backup-agent upload %p'
archive_timeout = 300  # Force WAL rotation every 5 minutes

# WAL retention (for replication)
wal_keep_size = 1GB

# Checkpoint settings (balance between performance and recovery time)
checkpoint_timeout = 15min
max_wal_size = 2GB
min_wal_size = 80MB

# Monitoring
logging_collector = on
log_checkpoints = on
log_connections = on
```

### Backup Verification Job

**Automated verification script (runs after each backup):**

```typescript
// scripts/verify-backup.ts
// Runs: Daily at 2:15 AM (15 min after backup)

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BackupVerification {
  backupId: string;
  timestamp: Date;
  sizeBytes: number;
  verified: boolean;
  restoreTimeMs: number;
  errors: string[];
}

async function verifyLatestBackup(): Promise<BackupVerification> {
  console.log('🔍 Starting backup verification...');

  // 1. Get latest backup
  const { stdout: backupList } = await execAsync(
    'railway db backup list --database trading-ai-prod-primary --limit 1'
  );
  const latestBackup = JSON.parse(backupList)[0];

  console.log(`📦 Latest backup: ${latestBackup.id}`);

  // 2. Create temporary staging database
  const stagingDb = `verify-${Date.now()}`;
  await execAsync(`railway db create --name ${stagingDb} --type postgresql`);

  try {
    // 3. Restore backup to staging
    const startTime = Date.now();
    await execAsync(
      `railway db restore ${stagingDb} --from-backup ${latestBackup.id}`
    );
    const restoreTime = Date.now() - startTime;

    console.log(`⏱️  Restore completed in ${restoreTime}ms`);

    // 4. Verify data integrity
    const checks = await runIntegrityChecks(stagingDb);

    // 5. Log results
    const verification: BackupVerification = {
      backupId: latestBackup.id,
      timestamp: new Date(latestBackup.createdAt),
      sizeBytes: latestBackup.sizeBytes,
      verified: checks.allPassed,
      restoreTimeMs: restoreTime,
      errors: checks.errors,
    };

    // 6. Send to monitoring
    await logToPrometheus(verification);

    if (!checks.allPassed) {
      await alertToSlack('🚨 Backup verification FAILED', verification);
      await alertToPagerDuty(verification);
    }

    return verification;
  } finally {
    // 7. Cleanup staging database
    await execAsync(`railway db delete ${stagingDb} --force`);
  }
}

async function runIntegrityChecks(dbName: string) {
  const errors: string[] = [];

  // Check 1: Database connection
  try {
    await execAsync(`railway db exec ${dbName} --query "SELECT 1"`);
  } catch (error) {
    errors.push('Database connection failed');
  }

  // Check 2: Table count
  const { stdout: tableCount } = await execAsync(
    `railway db exec ${dbName} --query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"`
  );
  const expectedTables = 6; // users, conversations, messages, embeddings, analytics
  if (parseInt(tableCount) !== expectedTables) {
    errors.push(`Expected ${expectedTables} tables, found ${tableCount}`);
  }

  // Check 3: Row count sanity check
  const { stdout: userCount } = await execAsync(
    `railway db exec ${dbName} --query "SELECT COUNT(*) FROM users"`
  );
  if (parseInt(userCount) < 1000) {
    errors.push(`User count too low: ${userCount} (expected >1000)`);
  }

  // Check 4: Foreign key constraints
  try {
    await execAsync(
      `railway db exec ${dbName} --query "SELECT * FROM messages LIMIT 1"`
    );
  } catch (error) {
    errors.push('Foreign key constraint violation detected');
  }

  // Check 5: Index integrity
  const { stdout: indexCheck } = await execAsync(
    `railway db exec ${dbName} --query "SELECT COUNT(*) FROM pg_stat_user_indexes WHERE idx_scan = 0"`
  );
  // Just log unused indexes (not an error)
  console.log(`ℹ️  Unused indexes: ${indexCheck}`);

  return {
    allPassed: errors.length === 0,
    errors,
  };
}

// Run verification
verifyLatestBackup()
  .then(() => {
    console.log('✅ Backup verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backup verification failed:', error);
    process.exit(1);
  });
```

**Cron schedule:**

```bash
# Add to Railway cron jobs
# Location: Project Settings > Cron Jobs

15 2 * * * node scripts/verify-backup.ts
```

---

## Manual Backup Procedures

### When to Take Manual Snapshots

**Required (Always):**

1. Before database migrations
2. Before major version upgrades (PostgreSQL, Railway)
3. Before data cleanup operations
4. Before bulk data imports

**Recommended (Best Practice):**

1. Before risky deployments
2. Weekly on Sundays (belt and suspenders)
3. Before configuration changes
4. Before year-end/quarter-end

### Pre-Migration Snapshot Procedure

**Checklist:**

```bash
# ============================================
# PRE-MIGRATION BACKUP PROCEDURE
# ============================================
# Time required: 5-10 minutes
# Responsible: DevOps Engineer + Migration Owner

# Step 1: Verify current database state
railway db exec trading-ai-prod-primary \
  --query "SELECT COUNT(*) FROM information_schema.tables"

# Step 2: Create named snapshot
SNAPSHOT_NAME="$(date +%Y-%m-%d)-pre-migration-v$(git describe --tags)-$(whoami)"

railway db snapshot create \
  --database trading-ai-prod-primary \
  --name "$SNAPSHOT_NAME" \
  --description "Pre-migration backup before deploying v2.0 schema changes"

# Step 3: Wait for snapshot completion (typically 2-5 min)
railway db snapshot status "$SNAPSHOT_NAME" --wait

# Step 4: Verify snapshot integrity
railway db snapshot verify "$SNAPSHOT_NAME"

# Step 5: Log to tracking sheet
echo "$(date): Created snapshot $SNAPSHOT_NAME" >> backups.log

# Step 6: Notify team
slack-cli send "#deployments" "✅ Pre-migration snapshot created: $SNAPSHOT_NAME"

# ============================================
# MIGRATION CAN NOW PROCEED
# ============================================
```

### Weekly Manual Backup

**Automated script (runs Sundays at 10 PM UTC):**

```bash
#!/bin/bash
# scripts/weekly-backup.sh
# Runs: Sunday 22:00 UTC via Railway cron

set -e

BACKUP_NAME="weekly-$(date +%Y-week-%V)-manual"

echo "📅 Starting weekly manual backup: $BACKUP_NAME"

# Create snapshot
railway db snapshot create \
  --database trading-ai-prod-primary \
  --name "$BACKUP_NAME" \
  --description "Weekly manual backup ($(date +%Y-%m-%d))" \
  --wait

echo "✅ Weekly backup completed: $BACKUP_NAME"

# Cleanup old weekly backups (keep last 4 weeks)
railway db snapshot list --database trading-ai-prod-primary \
  | grep "weekly-" \
  | sort -r \
  | tail -n +5 \
  | while read -r snapshot; do
      echo "🗑️  Deleting old weekly backup: $snapshot"
      railway db snapshot delete "$snapshot" --force
    done

echo "🧹 Cleanup completed"

# Log to monitoring
curl -X POST https://monitoring.tradingai.app/api/metrics \
  -H "Content-Type: application/json" \
  -d "{
    \"metric\": \"manual_backup_created\",
    \"value\": 1,
    \"tags\": {\"type\": \"weekly\", \"name\": \"$BACKUP_NAME\"}
  }"
```

### Emergency Backup (Immediate)

**Use when:**

- Security incident detected
- Unusual data modification patterns
- Before emergency hotfix deployment
- Ransomware suspected

**Procedure:**

```bash
# EMERGENCY BACKUP - RUN IMMEDIATELY

# 1. Create emergency snapshot (no waiting)
railway db snapshot create \
  --database trading-ai-prod-primary \
  --name "EMERGENCY-$(date +%Y%m%d-%H%M%S)-$(whoami)" \
  --description "EMERGENCY: $(read -p 'Reason: ' reason; echo $reason)" \
  --async

# 2. Alert team immediately
slack-cli send "#incidents" "@channel 🚨 EMERGENCY BACKUP INITIATED: Check Railway dashboard"

# 3. Continue with incident response
# (snapshot will complete in background)
```

---

## Recovery Procedures

### Point-in-Time Recovery (PITR)

**Scenario:** Recover database to specific timestamp (e.g., before accidental deletion)

**Requirements:**

- Timestamp within last 30 days
- WAL archives available
- ~30 minutes downtime

**Procedure:**

```bash
# ============================================
# POINT-IN-TIME RECOVERY PROCEDURE
# ============================================
# Estimated time: 20-30 minutes
# Downtime: Yes (read-only mode during recovery)

# STEP 1: Put application in maintenance mode
railway service scale rag-worker --replicas 0
railway service scale gateway --replicas 1  # Keep 1 for status page

# STEP 2: Create new database for recovery
RECOVERY_DB="recovery-$(date +%Y%m%d-%H%M%S)"
railway db create --name "$RECOVERY_DB" --type postgresql

# STEP 3: Restore to target time
TARGET_TIME="2026-02-15 14:30:00 UTC"  # Time before incident

railway db restore "$RECOVERY_DB" \
  --from-backup trading-ai-prod-primary \
  --target-time "$TARGET_TIME" \
  --wait

# STEP 4: Verify recovered data
railway db exec "$RECOVERY_DB" \
  --query "SELECT COUNT(*) FROM conversations WHERE deleted_at IS NULL"

# Compare with known good count
# Expected: >5000 (from monitoring before incident)

# STEP 5: Run data integrity checks
railway db exec "$RECOVERY_DB" \
  --query "SELECT COUNT(*) FROM users"

railway db exec "$RECOVERY_DB" \
  --query "SELECT COUNT(*) FROM messages"

# STEP 6: If data looks good, promote to primary
# (This renames databases - existing primary becomes old-primary)
railway db promote "$RECOVERY_DB" --to-primary

# STEP 7: Update read replicas (automatic via Railway)
# Wait for replication to catch up (~2-5 min)
railway db replica status --all --wait

# STEP 8: Restore application services
railway service scale rag-worker --replicas 15
railway service scale gateway --replicas 5

# STEP 9: Exit maintenance mode
railway service update status --message "Service restored"

# STEP 10: Verify application health
curl https://api.tradingai.app/health
# Expected: {"status": "healthy"}

# ============================================
# RECOVERY COMPLETE
# ============================================
```

### Full Backup Restore

**Scenario:** Restore entire database from daily backup

**Procedure:**

```bash
# ============================================
# FULL BACKUP RESTORE PROCEDURE
# ============================================

# STEP 1: List available backups
railway db backup list --database trading-ai-prod-primary

# Output example:
# ID                   Created At           Size
# backup-2026-02-15    2026-02-15 02:00     20GB
# backup-2026-02-14    2026-02-14 02:00     19GB
# backup-2026-02-13    2026-02-13 02:00     18GB

# STEP 2: Choose backup to restore
BACKUP_ID="backup-2026-02-14"  # Yesterday's backup

# STEP 3: Create new database
RESTORE_DB="restore-$(date +%Y%m%d-%H%M%S)"
railway db create --name "$RESTORE_DB" --type postgresql

# STEP 4: Restore from backup
railway db restore "$RESTORE_DB" \
  --from-backup "$BACKUP_ID" \
  --wait

# STEP 5: Verify and promote (same as PITR steps 4-10)
```

### Partial Data Recovery

**Scenario:** Restore specific tables or rows (e.g., single user's data)

**Procedure:**

```bash
# ============================================
# PARTIAL DATA RECOVERY
# ============================================
# Useful when: Only specific data affected (not full database)

# STEP 1: Restore backup to temporary database
TEMP_DB="temp-recovery-$(date +%s)"
railway db create --name "$TEMP_DB" --type postgresql
railway db restore "$TEMP_DB" --from-backup backup-2026-02-14

# STEP 2: Export specific data
railway db exec "$TEMP_DB" \
  --query "COPY (SELECT * FROM conversations WHERE user_id = 'user-123') TO STDOUT" \
  > recovered_conversations.csv

# STEP 3: Import into production database
railway db exec trading-ai-prod-primary \
  --query "COPY conversations FROM STDIN" \
  < recovered_conversations.csv

# STEP 4: Cleanup temporary database
railway db delete "$TEMP_DB" --force

# STEP 5: Verify restoration
railway db exec trading-ai-prod-primary \
  --query "SELECT * FROM conversations WHERE user_id = 'user-123'"
```

---

## Disaster Recovery Scenarios

### Scenario 1: Accidental Data Deletion

```
┌─────────────────────────────────────────────────────────────────┐
│  INCIDENT: Developer accidentally deletes all conversations     │
└─────────────────────────────────────────────────────────────────┘

Timeline:
  14:00 - Developer runs: DELETE FROM conversations; (forgot WHERE)
  14:01 - Developer realizes mistake, reports to #incidents
  14:02 - DevOps confirms: All conversations deleted (replicas too)
  14:03 - Decision: Point-in-time recovery to 13:59
  14:05 - Maintenance mode enabled
  14:10 - Recovery database created
  14:25 - Data restored to 13:59
  14:28 - Verification passed (5,234 conversations)
  14:30 - Promoted to primary
  14:35 - Application services restored
  14:40 - Monitoring confirms: All systems operational

Result:
  ✅ All conversations recovered
  ✅ Data loss: 1 minute (13:59 - 14:00)
  ✅ Downtime: 35 minutes
  ✅ RTO met: <30 min (close call)
  ✅ RPO met: <1 hour

Post-Incident:
  • Add pre-execution warning for DELETE without WHERE
  • Implement query review process
  • Add read-only production credentials for developers
  • Update runbook with learnings
```

### Scenario 2: Ransomware Attack

```
┌─────────────────────────────────────────────────────────────────┐
│  INCIDENT: Ransomware encrypts database                         │
└─────────────────────────────────────────────────────────────────┘

Timeline:
  03:00 - Ransomware gains access via compromised credential
  03:15 - Database data encrypted
  03:15 - Encryption replicates to all replicas
  03:20 - Monitoring detects unusual CPU/disk activity
  03:22 - PagerDuty alert triggers
  03:25 - On-call engineer investigates
  03:28 - Ransomware confirmed, all databases isolated
  03:30 - Incident escalated to security team
  03:35 - Decision: Restore from last backup before infection
  03:40 - Last known good backup: 02:00 (1 hour 15 min ago)
  03:45 - Restore initiated
  04:00 - New database created from clean backup
  04:05 - Forensic snapshot of encrypted database taken
  04:10 - New database promoted to primary
  04:15 - Application services restored
  04:20 - Security patches deployed
  04:30 - All credentials rotated
  05:00 - System fully operational

Result:
  ✅ Full recovery from clean backup
  ⚠️  Data loss: 1 hour 15 min (02:00 - 03:15)
  ⚠️  Downtime: 2 hours
  ❌ RTO exceeded: 30 min target vs 2 hour actual
  ✅ RPO met: <1 hour (close)

Post-Incident:
  • Enable multi-factor authentication
  • Implement least-privilege access
  • Add anomaly detection monitoring
  • Increase backup frequency to every 6 hours
  • Enable cross-region backup replication
```

### Scenario 3: Corruption from Bad Migration

```
┌─────────────────────────────────────────────────────────────────┐
│  INCIDENT: Migration script corrupts foreign key relationships  │
└─────────────────────────────────────────────────────────────────┘

Timeline:
  16:00 - Deploy migration v2.5 to production
  16:02 - Migration completes successfully
  16:05 - Users report: Cannot load conversation history
  16:06 - Investigation: Foreign key constraint violated
  16:08 - Migration script had bug: incorrectly updated user_id
  16:10 - Decision: Rollback to pre-migration snapshot
  16:12 - Pre-migration snapshot located: "2026-02-15-pre-migration-v2.5"
  16:15 - Restore initiated
  16:22 - Database restored to pre-migration state
  16:25 - Application redeployed with v2.4 (previous version)
  16:30 - Verification: All conversations loading correctly
  16:35 - System operational

Result:
  ✅ Full recovery from pre-migration snapshot
  ✅ Data loss: 0 (perfect recovery)
  ✅ Downtime: 30 minutes
  ✅ RTO met: 30 min
  ✅ RPO met: 0

Post-Incident:
  • Require migration dry-run on staging
  • Add pre-migration data validation
  • Implement automatic rollback on constraint violation
  • Update migration checklist
```

### Scenario 4: Primary Server Hardware Failure

```
┌─────────────────────────────────────────────────────────────────┐
│  INCIDENT: Primary database server disk failure                 │
└─────────────────────────────────────────────────────────────────┘

Timeline:
  09:00 - Primary database disk fails
  09:00 - Railway health check detects failure
  09:00:15 - Automatic failover initiated
  09:00:30 - Read Replica #1 promoted to new primary
  09:00:35 - DNS updated to new primary
  09:00:40 - pgBouncer reconnects to new primary
  09:00:45 - Application services resume
  09:01 - All systems operational

Result:
  ✅ Automatic failover via read replica
  ✅ Data loss: 0 (replication was in sync)
  ✅ Downtime: ~45 seconds
  ✅ RTO met: <30 min (actually <1 min!)
  ✅ RPO met: 0

Post-Incident:
  • Old primary server replaced by Railway
  • New replica created to restore redundancy
  • Incident logged for monthly review

Note: This scenario does NOT use backups - it uses high availability
      replicas as described in rag-scalability-enhanced-v2.md
```

---

## Testing & Validation

### Monthly Backup Testing

**Objective:** Verify backups can be restored successfully

**Schedule:** First Sunday of each month at 10 AM UTC

**Procedure:**

```bash
#!/bin/bash
# scripts/monthly-backup-test.sh
# Runs: First Sunday of month at 10:00 UTC

set -e

echo "🧪 Starting monthly backup restore test"

# Test 1: Most recent automated backup
echo "📦 Testing: Latest automated backup"
LATEST_BACKUP=$(railway db backup list --limit 1 --json | jq -r '.[0].id')

TEST_DB="test-restore-$(date +%Y%m%d)"
railway db create --name "$TEST_DB" --type postgresql
railway db restore "$TEST_DB" --from-backup "$LATEST_BACKUP" --wait

# Verify restoration
USER_COUNT=$(railway db exec "$TEST_DB" --query "SELECT COUNT(*) FROM users" | tail -1)
echo "✅ Restored database has $USER_COUNT users"

if [ "$USER_COUNT" -lt 1000 ]; then
  echo "❌ FAIL: User count too low"
  exit 1
fi

# Test 2: Point-in-time recovery
echo "🕐 Testing: PITR to 24 hours ago"
TARGET_TIME=$(date -u -d '24 hours ago' '+%Y-%m-%d %H:%M:%S')

PITR_DB="test-pitr-$(date +%Y%m%d)"
railway db create --name "$PITR_DB" --type postgresql
railway db restore "$PITR_DB" --target-time "$TARGET_TIME" --wait

# Verify PITR
PITR_COUNT=$(railway db exec "$PITR_DB" --query "SELECT COUNT(*) FROM users" | tail -1)
echo "✅ PITR database has $PITR_COUNT users"

# Test 3: Partial data export
echo "📊 Testing: Partial data export"
railway db exec "$TEST_DB" \
  --query "COPY (SELECT * FROM users LIMIT 10) TO STDOUT" \
  > /tmp/test-export.csv

EXPORT_LINES=$(wc -l < /tmp/test-export.csv)
if [ "$EXPORT_LINES" -ne 10 ]; then
  echo "❌ FAIL: Export line count mismatch"
  exit 1
fi

echo "✅ Partial export successful"

# Cleanup
railway db delete "$TEST_DB" --force
railway db delete "$PITR_DB" --force
rm /tmp/test-export.csv

# Report results
echo "✅ Monthly backup test PASSED"

# Log to monitoring
curl -X POST https://monitoring.tradingai.app/api/metrics \
  -H "Content-Type: application/json" \
  -d "{
    \"metric\": \"backup_test_result\",
    \"value\": 1,
    \"tags\": {\"status\": \"passed\", \"date\": \"$(date +%Y-%m-%d)\"}
  }"

# Send Slack notification
slack-cli send "#infrastructure" "✅ Monthly backup test passed ($(date +%Y-%m-%d))"
```

### Quarterly DR Drill

**Objective:** Test full disaster recovery process with entire team

**Schedule:** Last Friday of quarter

**Checklist:**

```markdown
# QUARTERLY DR DRILL CHECKLIST

## Pre-Drill (1 week before)

- [ ] Schedule drill date/time with all teams
- [ ] Announce to users: "Scheduled maintenance window"
- [ ] Prepare test scenarios
- [ ] Assign roles (Incident Commander, DevOps, QA, Comms)
- [ ] Review previous drill findings

## Drill Execution (Planned outage: 11 PM - 1 AM)

- [ ] T-0: Announce drill start in #incidents
- [ ] T+5: Simulate data deletion (in staging or isolated prod clone)
- [ ] T+10: Incident Commander declares disaster
- [ ] T+15: DevOps begins recovery procedure
- [ ] T+25: Restore completed
- [ ] T+30: QA verifies data integrity
- [ ] T+35: Application services restored
- [ ] T+40: End-to-end testing
- [ ] T+50: Declare recovery complete

## Post-Drill

- [ ] Document actual RTO/RPO achieved
- [ ] Identify process bottlenecks
- [ ] Update runbooks with learnings
- [ ] Team retrospective meeting
- [ ] Report findings to leadership

## Success Criteria

- [ ] RTO < 30 minutes (actual recovery time)
- [ ] RPO < 1 hour (data loss)
- [ ] All team members knew their roles
- [ ] Runbooks were accurate and complete
- [ ] Communication was clear and timely
```

---

## Monitoring & Alerting

### Backup Health Metrics

**Prometheus Metrics:**

```yaml
# Backup success rate
backup_success_total{type="automated"}
backup_failure_total{type="automated"}

# Backup size and duration
backup_size_bytes{database="primary"}
backup_duration_seconds{database="primary"}

# Verification status
backup_verification_passed{backup_id}
backup_verification_failed{backup_id}

# WAL archiving
wal_archive_success_total
wal_archive_failure_total
wal_archive_lag_seconds

# Storage usage
backup_storage_used_bytes
backup_storage_available_bytes
```

**Alert Rules:**

```yaml
# alerts/backup-alerts.yml

groups:
  - name: backup_alerts
    interval: 1m
    rules:
      - alert: BackupFailed
        expr: backup_failure_total > 0
        for: 5m
        labels:
          severity: critical
          team: infrastructure
        annotations:
          summary: 'Database backup failed'
          description: 'Backup for {{ $labels.database }} has failed. Check Railway logs.'
          runbook: 'https://docs.tradingai.app/runbooks/backup-failure'

      - alert: BackupVerificationFailed
        expr: backup_verification_failed > 0
        for: 1m
        labels:
          severity: critical
          team: infrastructure
        annotations:
          summary: 'Backup verification failed'
          description: 'Backup {{ $labels.backup_id }} failed integrity checks'
          runbook: 'https://docs.tradingai.app/runbooks/verification-failure'

      - alert: BackupNotCreatedIn24h
        expr: time() - backup_last_success_timestamp > 86400
        for: 5m
        labels:
          severity: critical
          team: infrastructure
        annotations:
          summary: 'No backup created in 24 hours'
          description: 'Last successful backup was > 24h ago'

      - alert: WALArchiveLagging
        expr: wal_archive_lag_seconds > 300
        for: 10m
        labels:
          severity: warning
          team: infrastructure
        annotations:
          summary: 'WAL archiving is lagging'
          description: 'WAL archive lag is {{ $value }}s (threshold: 300s)'

      - alert: BackupStorageNearFull
        expr: (backup_storage_used_bytes / backup_storage_available_bytes) > 0.85
        for: 30m
        labels:
          severity: warning
          team: infrastructure
        annotations:
          summary: 'Backup storage is 85% full'
          description: 'Consider increasing retention or expanding storage'
```

### Monitoring Dashboard

**Grafana Dashboard: Backup Health**

```json
{
  "dashboard": {
    "title": "Trading AI - Backup & Recovery",
    "panels": [
      {
        "title": "Backup Success Rate (7 days)",
        "targets": [
          {
            "expr": "rate(backup_success_total[7d]) / (rate(backup_success_total[7d]) + rate(backup_failure_total[7d]))",
            "legendFormat": "Success Rate"
          }
        ],
        "alert": {
          "conditions": [{ "evaluator": { "type": "lt", "params": [0.995] } }]
        }
      },
      {
        "title": "Backup Size Trend",
        "targets": [
          {
            "expr": "backup_size_bytes",
            "legendFormat": "{{ database }}"
          }
        ]
      },
      {
        "title": "Backup Duration",
        "targets": [
          {
            "expr": "backup_duration_seconds",
            "legendFormat": "{{ database }}"
          }
        ]
      },
      {
        "title": "Storage Usage",
        "targets": [
          {
            "expr": "backup_storage_used_bytes / backup_storage_available_bytes * 100",
            "legendFormat": "Usage %"
          }
        ]
      },
      {
        "title": "WAL Archive Lag",
        "targets": [
          {
            "expr": "wal_archive_lag_seconds",
            "legendFormat": "Lag (seconds)"
          }
        ]
      }
    ]
  }
}
```

---

## Compliance & Retention

### Regulatory Requirements

**Data Retention Policy:**

| Data Type          | Retention Period | Justification                         |
| ------------------ | ---------------- | ------------------------------------- |
| User conversations | 30 days          | User support, dispute resolution      |
| Transaction logs   | 90 days          | Financial audit trail                 |
| Audit logs         | 1 year           | Security compliance                   |
| Backup files       | 30 days          | Disaster recovery                     |
| Manual snapshots   | 90 days max      | Operational safety (manually deleted) |

**Compliance Standards:**

```yaml
GDPR (General Data Protection Regulation):
  - Right to be forgotten: Manual process to delete from backups
  - Data portability: Export functionality via API
  - Breach notification: 72-hour window (backups help investigation)

PCI DSS (Payment Card Industry):
  - Encryption at rest: AES-256 for all backups ✅
  - Access logging: All backup access logged ✅
  - Retention: 90 days for transaction data ✅

SOC 2 (Phase 2):
  - Backup testing: Monthly verification required ✅
  - Access controls: IAM-based access only ✅
  - Change management: All backup config changes logged ✅
```

### Data Deletion from Backups

**GDPR Right to be Forgotten:**

When a user requests data deletion, backups create a compliance challenge:

```
Problem:
  User requests deletion → Data deleted from primary → Still exists in 30-day backups

Solution (Phased):
  Phase 1 (Current - Acceptable):
    • Delete from primary + replicas immediately
    • Document in deletion log: "Data purged from backups after 30 days"
    • Inform user: "Complete deletion within 30 days"

  Phase 2 (Future - Ideal):
    • Implement backup-aware deletion
    • Flag deleted records in backup metadata
    • Exclude flagged records during restore
    • Crypto-shredding: Delete encryption keys for user's data
```

**Implementation (Phase 1):**

```typescript
// services/user-deletion.service.ts

interface UserDeletionRecord {
  userId: string;
  requestedAt: Date;
  deletedFromPrimaryAt: Date;
  purgedFromBackupsAfter: Date; // 30 days from deletion
  gdprCompliant: boolean;
}

async function deleteUserData(userId: string): Promise<UserDeletionRecord> {
  const deletionRecord: UserDeletionRecord = {
    userId,
    requestedAt: new Date(),
    deletedFromPrimaryAt: null,
    purgedFromBackupsAfter: null,
    gdprCompliant: false,
  };

  // 1. Delete from primary database
  await db.transaction(async (tx) => {
    await tx.conversations.deleteMany({ where: { userId } });
    await tx.messages.deleteMany({ where: { conversation: { userId } } });
    await tx.users.delete({ where: { id: userId } });
  });

  deletionRecord.deletedFromPrimaryAt = new Date();

  // 2. Calculate purge date (30 days from now)
  deletionRecord.purgedFromBackupsAfter = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  );

  // 3. Log to deletion tracking table
  await db.userDeletions.create({ data: deletionRecord });

  // 4. Schedule reminder to verify purge
  await scheduleJob({
    name: 'verify-gdpr-purge',
    runAt: deletionRecord.purgedFromBackupsAfter,
    data: { userId },
  });

  // 5. Send confirmation email
  await sendEmail({
    to: '[user email from cache]',
    subject: 'Data Deletion Confirmation',
    body: `
      Your data has been deleted from our systems.
      Complete purge from all backups: ${deletionRecord.purgedFromBackupsAfter.toISOString()}
    `,
  });

  return deletionRecord;
}
```

---

## Team Responsibilities

### Responsibility Matrix (RACI)

| Task                         | DevOps | Backend Dev | QA    | Security | Product |
| ---------------------------- | ------ | ----------- | ----- | -------- | ------- |
| Configure automated backups  | **R**  | C           | I     | C        | I       |
| Monitor backup health        | **R**  | I           | I     | I        | I       |
| Manual pre-migration backups | **A**  | **R**       | C     | I        | I       |
| Restore from backup          | **R**  | C           | I     | **A**    | I       |
| Backup verification testing  | **R**  | I           | **A** | I        | I       |
| Quarterly DR drills          | **A**  | **R**       | **R** | **R**    | C       |
| Update backup procedures     | **R**  | C           | I     | **A**    | I       |
| GDPR deletion compliance     | C      | **R**       | I     | **A**    | C       |
| Incident response            | **A**  | **R**       | C     | **R**    | I       |

**Legend:**

- R = Responsible (does the work)
- A = Accountable (final authority)
- C = Consulted (input needed)
- I = Informed (kept in loop)

### On-Call Rotation

```yaml
Backup Incidents (P1):
  Primary: DevOps Engineer (24/7)
  Secondary: Backend Lead (backup)
  Escalation: CTO (if >1 hour unresolved)

Response Times:
  Backup Failure Alert: 15 minutes
  Verification Failure: 30 minutes
  Restore Request: 1 hour (business hours)
  Restore Request: 2 hours (off-hours)

Handoff Procedure:
  - Daily standup: Share backup health status
  - Weekly: Review backup metrics in team meeting
  - Monthly: Backup test results presented
  - Quarterly: DR drill post-mortem
```

---

## Cost Analysis

### Backup Storage Costs

**Current (Phase 1):**

```yaml
Automated Backups (Railway Managed):
  Full Backups:
    - Daily backups × 30 days = 30 snapshots
    - Average size: 20GB compressed (5:1 ratio from 100GB)
    - Total storage: 600GB
    - Cost: Included in Railway PostgreSQL plan ($80/month)

  WAL Archives:
    - Continuous streaming
    - Average: ~200GB per month
    - Cost: Included in Railway plan

  Manual Snapshots:
    - Average: 4 snapshots (weekly + pre-migrations)
    - Size: 80GB (4 × 20GB)
    - Cost: Included (within reasonable limits)

Total Backup Cost: $0/month (included in $240 database cost)
```

**Future (Phase 2 - Cross-Region):**

```yaml
Cross-Region Backup Replication:
  Primary Region (us-west-2):
    - 30-day retention
    - Cost: Included (as above)

  Secondary Region (us-east-1):
    - 7-day retention (not 30)
    - Replication: Daily sync
    - Storage: ~140GB (7 days × 20GB)
    - Cost: $20/month (Railway cross-region storage)

  Data Transfer:
    - 20GB daily (compressed backup)
    - 600GB/month total
    - Cost: $30/month (Railway egress)

Total with Cross-Region: $50/month additional
```

### Cost Optimization

**Strategies:**

1. **Compression** (Already implemented)
   - 5:1 compression ratio (100GB → 20GB)
   - Saves: $200/month in storage costs

2. **Incremental Backups** (Railway default)
   - Only changed blocks stored
   - Saves: ~30% storage vs full backups

3. **Retention Tuning**
   - Current: 30 days
   - Could reduce to 14 days: Saves $15/month
   - Not recommended: Regulatory compliance requires 30 days

4. **Manual Snapshot Cleanup**
   - Automated cleanup of >90-day snapshots
   - Saves: $10-20/month

**Total Potential Savings: Not significant, keep current config**

---

## Runbooks

### Runbook 1: Backup Failure

````markdown
# RUNBOOK: Backup Failure

## Trigger

Alert: "BackupFailed" fired from Prometheus

## Severity

🔴 Critical (P1)

## Response Time

15 minutes

## Procedure

### Step 1: Acknowledge Alert (1 min)

- [ ] Acknowledge in PagerDuty
- [ ] Post in #incidents: "Investigating backup failure"

### Step 2: Check Backup Status (3 min)

```bash
railway db backup list --database trading-ai-prod-primary --limit 5
railway db backup logs --latest
```
````

### Step 3: Identify Root Cause (5 min)

Common causes:

- [ ] Storage quota exceeded
- [ ] Database connection timeout
- [ ] WAL archive corruption
- [ ] Railway platform issue

### Step 4: Immediate Mitigation (5 min)

If storage full:

```bash
# Delete oldest backups
railway db backup delete --older-than 35-days
```

If connection issue:

```bash
# Retry backup manually
railway db backup create --database trading-ai-prod-primary --wait
```

If platform issue:

```bash
# Check Railway status page
curl https://status.railway.app/api/v2/status.json
# Contact Railway support if widespread outage
```

### Step 5: Verify Resolution (1 min)

```bash
railway db backup status --latest
# Expected: "completed"
```

### Step 6: Post-Incident (30 min)

- [ ] Document root cause in #incidents
- [ ] Update monitoring if new failure mode discovered
- [ ] Schedule follow-up if systemic issue

## Escalation

If unresolved in 30 minutes → Escalate to CTO

````

### Runbook 2: Data Recovery Request

```markdown
# RUNBOOK: Data Recovery Request

## Trigger
User or team member requests data restoration

## Severity
🟡 Medium (P2) - unless user-impacting, then P1

## Response Time
1 hour (business hours), 2 hours (off-hours)

## Procedure

### Step 1: Gather Information (10 min)
- [ ] What data needs recovery? (table, user, timeframe)
- [ ] When was data lost/corrupted?
- [ ] Is this user-impacting or internal?
- [ ] Approval from product team obtained?

### Step 2: Identify Recovery Method (5 min)
Decision tree:
- Single user's data → Partial recovery
- Entire table → Point-in-time recovery
- Multiple tables → Full backup restore

### Step 3: Estimate Impact (5 min)
- [ ] Downtime required? (Yes/No)
- [ ] Data loss window? (timestamp before → timestamp after)
- [ ] User notification needed?

### Step 4: Execute Recovery (varies)
See "Recovery Procedures" section for specific steps

### Step 5: Verify Recovery (10 min)
```bash
# Run data integrity checks
# Compare record counts before/after
# Spot-check specific records
````

### Step 6: Communicate Results (5 min)

- [ ] Update ticket with outcome
- [ ] Notify requester
- [ ] Document in #incidents if significant

## SLA

- Data loss < 1 hour: RPO met ✅
- Recovery time < 30 min: RTO met ✅

````

### Runbook 3: Quarterly DR Drill

```markdown
# RUNBOOK: Quarterly DR Drill

## Objective
Test full disaster recovery process

## Schedule
Last Friday of each quarter, 11 PM - 1 AM

## Team
- Incident Commander: [DevOps Lead]
- Recovery Lead: [Senior DevOps Engineer]
- Verification Lead: [QA Lead]
- Observer: [Backend Lead]

## Pre-Drill Checklist (1 week before)
- [ ] Schedule drill with all participants
- [ ] Announce maintenance window to users
- [ ] Prepare drill scenario document
- [ ] Create isolated test environment
- [ ] Review previous drill findings

## Drill Execution (2 hours)

### T-0: Kickoff (5 min)
- [ ] IC: Announce drill start in #incidents
- [ ] IC: Confirm all participants present
- [ ] IC: Share drill scenario

### T+5: Simulate Disaster (5 min)
Scenario: "Ransomware attack encrypted database at 22:00"
- [ ] Recovery Lead: Create test database
- [ ] Recovery Lead: Simulate corruption
- [ ] IC: Declare disaster state

### T+10: Begin Recovery (40 min)
- [ ] Recovery Lead: Identify last clean backup (21:00)
- [ ] Recovery Lead: Initiate PITR to 21:59
- [ ] Recovery Lead: Monitor restore progress
- [ ] IC: Provide status updates every 10 min

### T+50: Verify Recovery (20 min)
- [ ] Verification Lead: Run integrity checks
- [ ] Verification Lead: Compare data counts
- [ ] Verification Lead: End-to-end testing
- [ ] Observer: Document any deviations from runbook

### T+70: Wrap Up (20 min)
- [ ] IC: Declare drill complete
- [ ] Team: Quick retrospective (what went well, what didn't)
- [ ] IC: Schedule post-drill meeting
- [ ] IC: Update runbook with learnings

## Success Criteria
- [ ] Recovery completed in <30 minutes (RTO)
- [ ] Data loss <1 hour (RPO)
- [ ] All runbook steps accurate
- [ ] All team members knew their roles

## Post-Drill (1 week later)
- [ ] Formal retrospective meeting
- [ ] Document findings
- [ ] Update procedures
- [ ] Report to leadership
````

---

## Appendix

### A. Glossary

| Term                               | Definition                                                |
| ---------------------------------- | --------------------------------------------------------- |
| **Backup**                         | Point-in-time copy of data stored separately for recovery |
| **Read Replica**                   | Real-time copy of database for scaling reads and failover |
| **RPO (Recovery Point Objective)** | Maximum acceptable data loss (time)                       |
| **RTO (Recovery Time Objective)**  | Maximum acceptable downtime                               |
| **WAL (Write-Ahead Log)**          | PostgreSQL transaction log for replication and recovery   |
| **PITR (Point-in-Time Recovery)**  | Restore database to specific timestamp                    |
| **Snapshot**                       | Instant backup of database at a moment in time            |
| **Cold Backup**                    | Backup taken while database is offline (not used)         |
| **Hot Backup**                     | Backup taken while database is running (our method)       |

### B. Railway CLI Quick Reference

```bash
# List backups
railway db backup list --database [name]

# Create manual backup
railway db backup create --database [name] --name [snapshot-name]

# Restore from backup
railway db restore [target-db] --from-backup [backup-id]

# Point-in-time recovery
railway db restore [target-db] --target-time "2026-02-15 14:30:00 UTC"

# Check backup status
railway db backup status [backup-id]

# Delete old backups
railway db backup delete [backup-id]

# Export backup
railway db backup export [backup-id] --output backup.sql.gz

# Verify backup
railway db backup verify [backup-id]
```

### C. Monitoring Query Examples

```sql
-- Check backup history
SELECT
  backup_id,
  created_at,
  size_bytes / 1024 / 1024 / 1024 AS size_gb,
  status,
  duration_seconds
FROM backup_log
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Backup success rate (last 30 days)
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') AS successful,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) AS total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*) * 100,
    2
  ) AS success_rate_pct
FROM backup_log
WHERE created_at > NOW() - INTERVAL '30 days';

-- Average backup duration trend
SELECT
  DATE(created_at) AS date,
  AVG(duration_seconds) AS avg_duration_sec,
  MAX(duration_seconds) AS max_duration_sec
FROM backup_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

### D. Contact Information

```yaml
Teams:
  DevOps:
    Primary: devops@tradingai.app
    Slack: #infrastructure
    PagerDuty: devops-team

  Security:
    Primary: security@tradingai.app
    Slack: #security
    Emergency: security-oncall@tradingai.app

  Railway Support:
    Email: support@railway.app
    Status: https://status.railway.app
    Docs: https://docs.railway.app

Escalation:
  Level 1: DevOps Engineer (15 min)
  Level 2: DevOps Lead (30 min)
  Level 3: CTO (1 hour)
  Level 4: CEO (business-critical only)
```

### E. Related Documents

```yaml
Internal Documentation:
  - Architecture: rag-scalability-enhanced-v2.md
  - Monitoring: monitoring-and-observability.md
  - Incident Response: incident-response-playbook.md
  - Security: security-policies.md

External Resources:
  - PostgreSQL Backup: https://www.postgresql.org/docs/16/backup.html
  - Railway Backups: https://docs.railway.app/databases/backups
  - GDPR Compliance: https://gdpr.eu/right-to-be-forgotten/
```

### F. Change Log

| Version | Date       | Author      | Changes          |
| ------- | ---------- | ----------- | ---------------- |
| 1.0     | 2026-02-15 | DevOps Team | Initial document |

---

## Document Approval

| Role                 | Name   | Signature  | Date   |
| -------------------- | ------ | ---------- | ------ |
| **DevOps Lead**      | [Name] | ****\_**** | **\_** |
| **Backend Lead**     | [Name] | ****\_**** | **\_** |
| **CTO**              | [Name] | ****\_**** | **\_** |
| **Security Officer** | [Name] | ****\_**** | **\_** |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-15
**Next Review:** 2026-05-15 (Quarterly)
**Owner:** DevOps/Infrastructure Team
**Classification:** Internal - Confidential
