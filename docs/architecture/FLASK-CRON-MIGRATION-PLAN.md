# Flask Backend Cron Job Migration Plan

**Version:** 1.0.0
**Created:** 2025-12-20
**Status:** Architecture Design (Pre-MVP Implementation)
**Target:** Post-MVP with Railway Pro Plan

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [APScheduler Deep Dive](#apscheduler-deep-dive)
5. [Implementation Plan](#implementation-plan)
6. [Database Integration](#database-integration)
7. [API Communication](#api-communication)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Railway Deployment](#railway-deployment)
10. [Migration Steps](#migration-steps)
11. [Rollback Plan](#rollback-plan)
12. [Cost Analysis](#cost-analysis)
13. [Risk Assessment](#risk-assessment)

---

## Executive Summary

### Why Migrate?

| Factor              | Vercel Crons           | Flask APScheduler             |
| ------------------- | ---------------------- | ----------------------------- |
| **Job Limit**       | 2 (free), 10 (Pro)     | Unlimited                     |
| **Scheduling**      | Basic cron syntax      | Cron, interval, date triggers |
| **Retry Logic**     | None built-in          | Configurable retries          |
| **Job Persistence** | None                   | PostgreSQL-backed             |
| **Monitoring**      | Basic logs             | Custom dashboards             |
| **Cost**            | $20/mo for Pro         | Included in Railway           |
| **Timeout**         | 60s (free), 300s (Pro) | No limit                      |

### Recommendation

Migrate all maintenance cron jobs to Flask backend when:

1. You upgrade to Railway Pro Plan (always-on guarantee)
2. You need more than 2 cron jobs
3. You need advanced features (retries, persistence, monitoring)

---

## Current State Analysis

### Existing Vercel Cron Jobs

```json
{
  "crons": [
    {
      "path": "/api/cron/distribute-codes",
      "schedule": "0 0 1 * *",
      "description": "Monthly affiliate code distribution"
    },
    {
      "path": "/api/cron/daily-maintenance",
      "schedule": "0 9 * * *",
      "description": "Combined: expire codes, check subscriptions, downgrade expired"
    }
  ]
}
```

### Jobs Currently Consolidated

The `daily-maintenance` endpoint combines 3 logical jobs:

1. **Expire Affiliate Codes** - Mark expired codes as EXPIRED
2. **Check Expiring Subscriptions** - 3-day renewal reminder for dLocal
3. **Downgrade Expired Subscriptions** - Move expired dLocal users to FREE

### Future Job Candidates

Jobs that will benefit from Flask migration:

- Email notification sending (batch processing)
- Usage analytics aggregation
- Database cleanup tasks
- Stripe/dLocal webhook reconciliation
- User activity reports generation

---

## Target Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAILWAY INFRASTRUCTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Flask MT5 Service                        │   │
│  │                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐    │   │
│  │  │  MT5 Routes     │  │  APScheduler                │    │   │
│  │  │  /api/indicators│  │  ┌───────────────────────┐  │    │   │
│  │  │  /api/health    │  │  │ Job Store (PostgreSQL)│  │    │   │
│  │  │  /api/admin/*   │  │  └───────────────────────┘  │    │   │
│  │  └─────────────────┘  │  ┌───────────────────────┐  │    │   │
│  │                       │  │ Executors (Thread)    │  │    │   │
│  │  ┌─────────────────┐  │  └───────────────────────┘  │    │   │
│  │  │  Cron Routes    │  │  ┌───────────────────────┐  │    │   │
│  │  │  /api/cron/*    │  │  │ Scheduler (Background)│  │    │   │
│  │  └─────────────────┘  │  └───────────────────────┘  │    │   │
│  │                       └─────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   PostgreSQL (Shared)                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ App Tables  │  │ Job Store   │  │ Job History     │   │   │
│  │  │ (Users,     │  │ (apscheduler│  │ (cron_job_runs) │   │   │
│  │  │  Payments)  │  │  _jobs)     │  │                 │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VERCEL INFRASTRUCTURE                        │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Application                                             │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │  Frontend       │  │  API Routes     │                       │
│  │  (React)        │  │  /api/*         │                       │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component       | Responsibility                                  |
| --------------- | ----------------------------------------------- |
| **APScheduler** | Job scheduling, trigger management, retry logic |
| **Job Store**   | Persist job definitions across restarts         |
| **Executors**   | Run jobs in background threads                  |
| **Cron Routes** | Manual trigger endpoints, job management API    |
| **Job History** | Track execution results for monitoring          |

---

## APScheduler Deep Dive

### What is APScheduler?

APScheduler (Advanced Python Scheduler) is a Python library for scheduling jobs. It supports:

- **Cron triggers**: Run at specific times (like Vercel crons)
- **Interval triggers**: Run every N seconds/minutes/hours
- **Date triggers**: Run once at a specific datetime
- **Job stores**: Persist jobs to database (survives restarts)
- **Executors**: Run jobs in threads or processes

### APScheduler vs Alternatives

| Feature                  | APScheduler      | Celery Beat    | Python-crontab |
| ------------------------ | ---------------- | -------------- | -------------- |
| Complexity               | Low              | High           | Very Low       |
| Dependencies             | 1 package        | Redis/RabbitMQ | System cron    |
| Job Persistence          | Yes (SQLAlchemy) | Yes (Redis)    | No             |
| Dynamic Jobs             | Yes              | Limited        | No             |
| Django/Flask Integration | Native           | Native         | Manual         |
| Memory Usage             | ~50MB            | ~200MB         | N/A            |

**Why APScheduler for your use case:**

- No additional infrastructure (Celery needs Redis/RabbitMQ)
- Native Flask integration
- Job persistence using existing PostgreSQL
- Low complexity for your job count

### APScheduler Components

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.triggers.cron import CronTrigger

# Job stores define where job definitions are persisted
jobstores = {
    'default': SQLAlchemyJobStore(url='postgresql://...')
}

# Executors define how jobs are run
executors = {
    'default': ThreadPoolExecutor(20)  # 20 concurrent jobs max
}

# Job defaults
job_defaults = {
    'coalesce': False,      # Run all missed executions
    'max_instances': 1,     # Only one instance of each job at a time
    'misfire_grace_time': 3600  # Allow 1 hour grace for missed jobs
}

scheduler = BackgroundScheduler(
    jobstores=jobstores,
    executors=executors,
    job_defaults=job_defaults,
    timezone='UTC'
)
```

### Trigger Types

```python
# Cron trigger (like Vercel crons)
CronTrigger(hour=9, minute=0)           # Daily at 9:00 UTC
CronTrigger(day=1, hour=0, minute=0)    # Monthly on 1st at midnight
CronTrigger(day_of_week='mon-fri')      # Weekdays only

# Interval trigger
IntervalTrigger(hours=1)                # Every hour
IntervalTrigger(minutes=30)             # Every 30 minutes

# Date trigger (one-time)
DateTrigger(run_date=datetime(2025, 12, 31, 23, 59))
```

---

## Implementation Plan

### Project Structure

```
mt5-service/
├── app/
│   ├── __init__.py              # Flask app factory
│   ├── routes/
│   │   ├── indicators.py        # Existing MT5 routes
│   │   ├── admin.py             # Existing admin routes
│   │   └── cron.py              # NEW: Cron management routes
│   ├── services/
│   │   ├── mt5_connection_pool.py
│   │   ├── tier_service.py
│   │   └── indicator_reader.py
│   ├── jobs/                    # NEW: Cron job definitions
│   │   ├── __init__.py
│   │   ├── base.py              # Base job class
│   │   ├── expire_codes.py
│   │   ├── check_expiring_subscriptions.py
│   │   ├── downgrade_expired_subscriptions.py
│   │   └── distribute_codes.py
│   └── scheduler/               # NEW: APScheduler setup
│       ├── __init__.py
│       ├── config.py            # Scheduler configuration
│       └── manager.py           # Scheduler lifecycle management
├── config/
│   ├── mt5_terminals.json
│   └── jobs.json                # NEW: Job schedule configuration
├── migrations/                  # NEW: Database migrations
│   └── add_job_history_table.sql
└── requirements.txt             # Updated with APScheduler
```

### Phase 1: Scheduler Infrastructure

**File: `app/scheduler/config.py`**

```python
"""
APScheduler Configuration

Configures the scheduler with PostgreSQL job store for persistence.
"""

import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.events import (
    EVENT_JOB_EXECUTED,
    EVENT_JOB_ERROR,
    EVENT_JOB_MISSED
)


def get_scheduler_config() -> dict:
    """
    Returns APScheduler configuration dictionary.

    Uses PostgreSQL for job persistence to survive restarts.
    Uses ThreadPoolExecutor for concurrent job execution.
    """
    database_url = os.environ.get('DATABASE_URL')

    if not database_url:
        raise ValueError("DATABASE_URL environment variable required")

    return {
        'jobstores': {
            'default': SQLAlchemyJobStore(
                url=database_url,
                tablename='apscheduler_jobs'
            )
        },
        'executors': {
            'default': ThreadPoolExecutor(max_workers=10)
        },
        'job_defaults': {
            'coalesce': True,           # Combine missed runs into one
            'max_instances': 1,          # Prevent concurrent execution
            'misfire_grace_time': 3600,  # 1 hour grace for missed jobs
            'replace_existing': True     # Update job if already exists
        },
        'timezone': 'UTC'
    }


def create_scheduler() -> BackgroundScheduler:
    """
    Creates and returns a configured BackgroundScheduler instance.
    """
    config = get_scheduler_config()
    scheduler = BackgroundScheduler(**config)

    # Add event listeners for monitoring
    scheduler.add_listener(on_job_executed, EVENT_JOB_EXECUTED)
    scheduler.add_listener(on_job_error, EVENT_JOB_ERROR)
    scheduler.add_listener(on_job_missed, EVENT_JOB_MISSED)

    return scheduler


def on_job_executed(event):
    """Log successful job execution."""
    from app.scheduler.manager import log_job_run
    log_job_run(
        job_id=event.job_id,
        status='success',
        duration_ms=int(event.retval.get('duration_ms', 0)) if event.retval else 0,
        result=event.retval
    )


def on_job_error(event):
    """Log failed job execution."""
    from app.scheduler.manager import log_job_run
    import traceback
    log_job_run(
        job_id=event.job_id,
        status='error',
        error=str(event.exception),
        traceback=traceback.format_exc()
    )


def on_job_missed(event):
    """Log missed job execution."""
    from app.scheduler.manager import log_job_run
    log_job_run(
        job_id=event.job_id,
        status='missed',
        scheduled_time=event.scheduled_run_time.isoformat()
    )
```

**File: `app/scheduler/manager.py`**

```python
"""
Scheduler Manager

Handles scheduler lifecycle: start, stop, job registration.
Provides job run logging for monitoring.
"""

import json
from datetime import datetime
from typing import Optional, Dict, Any
from apscheduler.triggers.cron import CronTrigger

from app.scheduler.config import create_scheduler


# Global scheduler instance
_scheduler = None


def get_scheduler():
    """Get the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = create_scheduler()
    return _scheduler


def start_scheduler():
    """Start the scheduler if not already running."""
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        print("[SCHEDULER] Started APScheduler")
        register_jobs()
    return scheduler


def stop_scheduler():
    """Gracefully stop the scheduler."""
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=True)
        print("[SCHEDULER] Stopped APScheduler")


def register_jobs():
    """
    Register all cron jobs with the scheduler.

    Jobs are defined in config/jobs.json for easy configuration.
    """
    from app.jobs import (
        expire_codes_job,
        check_expiring_subscriptions_job,
        downgrade_expired_subscriptions_job,
        distribute_codes_job
    )

    scheduler = get_scheduler()

    # Job definitions with their triggers
    jobs = [
        {
            'id': 'expire_codes',
            'func': expire_codes_job,
            'trigger': CronTrigger(hour=9, minute=0),
            'name': 'Expire Affiliate Codes'
        },
        {
            'id': 'check_expiring_subscriptions',
            'func': check_expiring_subscriptions_job,
            'trigger': CronTrigger(hour=9, minute=5),
            'name': 'Check Expiring dLocal Subscriptions'
        },
        {
            'id': 'downgrade_expired_subscriptions',
            'func': downgrade_expired_subscriptions_job,
            'trigger': CronTrigger(hour=9, minute=10),
            'name': 'Downgrade Expired Subscriptions'
        },
        {
            'id': 'distribute_codes',
            'func': distribute_codes_job,
            'trigger': CronTrigger(day=1, hour=0, minute=0),
            'name': 'Monthly Affiliate Code Distribution'
        }
    ]

    for job in jobs:
        scheduler.add_job(
            func=job['func'],
            trigger=job['trigger'],
            id=job['id'],
            name=job['name'],
            replace_existing=True
        )
        print(f"[SCHEDULER] Registered job: {job['id']}")


def log_job_run(
    job_id: str,
    status: str,
    duration_ms: int = 0,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    traceback: Optional[str] = None,
    scheduled_time: Optional[str] = None
):
    """
    Log job execution to database for monitoring.

    Creates entries in cron_job_runs table for dashboard display.
    """
    from app import db  # SQLAlchemy instance

    try:
        db.session.execute(
            """
            INSERT INTO cron_job_runs
            (job_id, status, duration_ms, result, error, traceback, scheduled_time, created_at)
            VALUES (:job_id, :status, :duration_ms, :result, :error, :traceback, :scheduled_time, :created_at)
            """,
            {
                'job_id': job_id,
                'status': status,
                'duration_ms': duration_ms,
                'result': json.dumps(result) if result else None,
                'error': error,
                'traceback': traceback,
                'scheduled_time': scheduled_time,
                'created_at': datetime.utcnow().isoformat()
            }
        )
        db.session.commit()
    except Exception as e:
        print(f"[SCHEDULER] Failed to log job run: {e}")
```

### Phase 2: Job Implementations

**File: `app/jobs/__init__.py`**

```python
"""
Cron Job Definitions

Each job is a function that:
1. Performs the scheduled task
2. Returns a result dict with metrics
3. Handles its own errors gracefully
"""

from app.jobs.expire_codes import expire_codes_job
from app.jobs.check_expiring_subscriptions import check_expiring_subscriptions_job
from app.jobs.downgrade_expired_subscriptions import downgrade_expired_subscriptions_job
from app.jobs.distribute_codes import distribute_codes_job

__all__ = [
    'expire_codes_job',
    'check_expiring_subscriptions_job',
    'downgrade_expired_subscriptions_job',
    'distribute_codes_job'
]
```

**File: `app/jobs/base.py`**

```python
"""
Base Job Utilities

Common utilities for all cron jobs including timing,
error handling, and result formatting.
"""

import time
import functools
from typing import Callable, Dict, Any


def timed_job(func: Callable) -> Callable:
    """
    Decorator that wraps job functions with timing and error handling.

    Returns a standardized result dict:
    {
        'success': bool,
        'duration_ms': int,
        'result': {...} or None,
        'error': str or None
    }
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Dict[str, Any]:
        start_time = time.time()

        try:
            result = func(*args, **kwargs)
            duration_ms = int((time.time() - start_time) * 1000)

            return {
                'success': True,
                'duration_ms': duration_ms,
                'result': result,
                'error': None
            }
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)

            return {
                'success': False,
                'duration_ms': duration_ms,
                'result': None,
                'error': str(e)
            }

    return wrapper
```

**File: `app/jobs/expire_codes.py`**

```python
"""
Expire Affiliate Codes Job

Marks all affiliate codes past their expiration date as EXPIRED.
Runs daily at 9:00 UTC.
"""

from datetime import datetime
from app.jobs.base import timed_job
from app import db


@timed_job
def expire_codes_job() -> dict:
    """
    Find and expire all affiliate codes past their expiresAt date.

    Returns:
        dict with count of expired codes
    """
    now = datetime.utcnow()

    result = db.session.execute(
        """
        UPDATE affiliate_codes
        SET status = 'EXPIRED', updated_at = :now
        WHERE status = 'ACTIVE' AND expires_at <= :now
        RETURNING id
        """,
        {'now': now}
    )

    expired_ids = result.fetchall()
    db.session.commit()

    return {
        'expired_count': len(expired_ids),
        'expired_ids': [str(row[0]) for row in expired_ids]
    }
```

**File: `app/jobs/check_expiring_subscriptions.py`**

```python
"""
Check Expiring Subscriptions Job

Finds dLocal subscriptions expiring in 3 days and marks them
for renewal reminder emails.

Runs daily at 9:05 UTC.
"""

from datetime import datetime, timedelta
from app.jobs.base import timed_job
from app import db


@timed_job
def check_expiring_subscriptions_job() -> dict:
    """
    Find dLocal subscriptions expiring in 3 days.
    Mark renewalReminderSent = true to prevent duplicate emails.

    Returns:
        dict with count of subscriptions marked for reminder
    """
    now = datetime.utcnow()
    three_days_later = now + timedelta(days=3)

    # Find expiring subscriptions that haven't had reminder sent
    result = db.session.execute(
        """
        SELECT
            s.id,
            s.user_id,
            u.email,
            s.expires_at
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.provider = 'dlocal'
          AND s.status = 'active'
          AND s.expires_at > :now
          AND s.expires_at <= :three_days
          AND s.renewal_reminder_sent = false
        """,
        {'now': now, 'three_days': three_days_later}
    )

    expiring = result.fetchall()

    # Mark as reminded
    if expiring:
        subscription_ids = [row[0] for row in expiring]
        db.session.execute(
            """
            UPDATE subscriptions
            SET renewal_reminder_sent = true, updated_at = :now
            WHERE id = ANY(:ids)
            """,
            {'now': now, 'ids': subscription_ids}
        )
        db.session.commit()

    # TODO: Part 18C - Send actual reminder emails here
    # For now, just mark for reminder

    return {
        'expiring_count': len(expiring),
        'reminders_marked': len(expiring),
        'users': [
            {
                'user_id': str(row[1]),
                'email': row[2],
                'expires_at': row[3].isoformat()
            }
            for row in expiring
        ]
    }
```

**File: `app/jobs/downgrade_expired_subscriptions.py`**

```python
"""
Downgrade Expired Subscriptions Job

Finds dLocal subscriptions that have expired and downgrades
users to FREE tier.

Runs daily at 9:10 UTC.
"""

from datetime import datetime
from app.jobs.base import timed_job
from app import db


@timed_job
def downgrade_expired_subscriptions_job() -> dict:
    """
    Find expired dLocal subscriptions and downgrade users to FREE tier.

    Steps:
    1. Find all active dLocal subscriptions past expires_at
    2. Update subscription status to 'expired'
    3. Downgrade user tier to 'FREE'
    4. Create notification for user

    Returns:
        dict with count of downgraded subscriptions
    """
    now = datetime.utcnow()

    # Find expired subscriptions
    result = db.session.execute(
        """
        SELECT
            s.id as subscription_id,
            s.user_id,
            u.email,
            u.tier as current_tier
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.provider = 'dlocal'
          AND s.status = 'active'
          AND s.expires_at <= :now
        """,
        {'now': now}
    )

    expired = result.fetchall()

    downgraded = []
    for row in expired:
        subscription_id, user_id, email, current_tier = row

        # Skip if already FREE
        if current_tier == 'FREE':
            continue

        # Update subscription status
        db.session.execute(
            """
            UPDATE subscriptions
            SET status = 'expired', updated_at = :now
            WHERE id = :id
            """,
            {'now': now, 'id': subscription_id}
        )

        # Downgrade user to FREE
        db.session.execute(
            """
            UPDATE users
            SET tier = 'FREE', updated_at = :now
            WHERE id = :id
            """,
            {'now': now, 'id': user_id}
        )

        # Create notification
        db.session.execute(
            """
            INSERT INTO notifications (user_id, type, title, message, created_at)
            VALUES (:user_id, 'subscription_expired', 'Subscription Expired',
                    'Your subscription has expired. You have been downgraded to the FREE tier.',
                    :now)
            """,
            {'user_id': user_id, 'now': now}
        )

        downgraded.append({
            'user_id': str(user_id),
            'email': email,
            'previous_tier': current_tier
        })

    db.session.commit()

    return {
        'expired_count': len(expired),
        'downgraded_count': len(downgraded),
        'downgraded_users': downgraded
    }
```

**File: `app/jobs/distribute_codes.py`**

```python
"""
Distribute Affiliate Codes Job

Monthly job that distributes new affiliate codes to eligible affiliates.
Runs on the 1st of each month at midnight UTC.
"""

from datetime import datetime
from app.jobs.base import timed_job
from app import db


@timed_job
def distribute_codes_job() -> dict:
    """
    Distribute monthly affiliate codes to eligible affiliates.

    Logic:
    1. Find active affiliates
    2. Check their tier and code allocation
    3. Generate new codes as needed

    Returns:
        dict with distribution results
    """
    now = datetime.utcnow()

    # Placeholder implementation
    # Actual logic depends on affiliate system design

    return {
        'distributed_count': 0,
        'affiliates_processed': 0,
        'message': 'Distribution logic to be implemented based on affiliate system requirements'
    }
```

### Phase 3: API Routes

**File: `app/routes/cron.py`**

```python
"""
Cron Management API Routes

Provides endpoints for:
- Viewing scheduled jobs
- Manually triggering jobs
- Viewing job history
- Pausing/resuming scheduler
"""

from flask import Blueprint, jsonify, request
from functools import wraps
import os

from app.scheduler.manager import get_scheduler


cron_bp = Blueprint('cron', __name__, url_prefix='/api/cron')


def require_cron_secret(f):
    """Decorator to require CRON_SECRET for protected endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        cron_secret = os.environ.get('CRON_SECRET')

        if not cron_secret:
            return jsonify({'error': 'CRON_SECRET not configured'}), 500

        if auth_header != f'Bearer {cron_secret}':
            return jsonify({'error': 'Unauthorized'}), 401

        return f(*args, **kwargs)
    return decorated


@cron_bp.route('/jobs', methods=['GET'])
@require_cron_secret
def list_jobs():
    """
    GET /api/cron/jobs

    List all scheduled jobs with their next run time.
    """
    scheduler = get_scheduler()
    jobs = []

    for job in scheduler.get_jobs():
        jobs.append({
            'id': job.id,
            'name': job.name,
            'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
            'trigger': str(job.trigger)
        })

    return jsonify({
        'scheduler_running': scheduler.running,
        'job_count': len(jobs),
        'jobs': jobs
    })


@cron_bp.route('/jobs/<job_id>/run', methods=['POST'])
@require_cron_secret
def run_job(job_id: str):
    """
    POST /api/cron/jobs/{job_id}/run

    Manually trigger a specific job.
    """
    scheduler = get_scheduler()
    job = scheduler.get_job(job_id)

    if not job:
        return jsonify({'error': f'Job {job_id} not found'}), 404

    # Run the job immediately
    try:
        result = job.func()
        return jsonify({
            'success': True,
            'job_id': job_id,
            'result': result
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'job_id': job_id,
            'error': str(e)
        }), 500


@cron_bp.route('/jobs/<job_id>/pause', methods=['POST'])
@require_cron_secret
def pause_job(job_id: str):
    """
    POST /api/cron/jobs/{job_id}/pause

    Pause a specific job.
    """
    scheduler = get_scheduler()
    job = scheduler.get_job(job_id)

    if not job:
        return jsonify({'error': f'Job {job_id} not found'}), 404

    scheduler.pause_job(job_id)
    return jsonify({'success': True, 'job_id': job_id, 'status': 'paused'})


@cron_bp.route('/jobs/<job_id>/resume', methods=['POST'])
@require_cron_secret
def resume_job(job_id: str):
    """
    POST /api/cron/jobs/{job_id}/resume

    Resume a paused job.
    """
    scheduler = get_scheduler()
    job = scheduler.get_job(job_id)

    if not job:
        return jsonify({'error': f'Job {job_id} not found'}), 404

    scheduler.resume_job(job_id)
    return jsonify({'success': True, 'job_id': job_id, 'status': 'resumed'})


@cron_bp.route('/history', methods=['GET'])
@require_cron_secret
def get_history():
    """
    GET /api/cron/history

    Get recent job execution history.
    Query params:
    - limit: Number of records (default 50)
    - job_id: Filter by job ID
    - status: Filter by status (success/error/missed)
    """
    from app import db

    limit = request.args.get('limit', 50, type=int)
    job_id = request.args.get('job_id')
    status = request.args.get('status')

    query = "SELECT * FROM cron_job_runs WHERE 1=1"
    params = {}

    if job_id:
        query += " AND job_id = :job_id"
        params['job_id'] = job_id

    if status:
        query += " AND status = :status"
        params['status'] = status

    query += " ORDER BY created_at DESC LIMIT :limit"
    params['limit'] = limit

    result = db.session.execute(query, params)

    history = []
    for row in result:
        history.append({
            'id': row.id,
            'job_id': row.job_id,
            'status': row.status,
            'duration_ms': row.duration_ms,
            'result': row.result,
            'error': row.error,
            'created_at': row.created_at
        })

    return jsonify({
        'count': len(history),
        'history': history
    })


@cron_bp.route('/health', methods=['GET'])
def scheduler_health():
    """
    GET /api/cron/health

    Health check for scheduler (no auth required).
    """
    scheduler = get_scheduler()

    return jsonify({
        'scheduler_running': scheduler.running,
        'job_count': len(scheduler.get_jobs()),
        'status': 'healthy' if scheduler.running else 'stopped'
    })
```

### Phase 4: Flask App Integration

**Updated `app/__init__.py`**

```python
"""
Flask Application Factory

Creates and configures the Flask application with:
- MT5 connection pool
- Health monitor
- APScheduler for cron jobs
"""

import atexit
from flask import Flask
from flask_cors import CORS

from app.routes.indicators import indicators_bp
from app.routes.admin import admin_bp
from app.routes.cron import cron_bp
from app.services.mt5_connection_pool import init_connection_pool, shutdown_connection_pool
from app.services.health_monitor import start_health_monitor, stop_health_monitor
from app.scheduler.manager import start_scheduler, stop_scheduler


def create_app(config_path: str = None) -> Flask:
    """
    Application factory function.

    Args:
        config_path: Path to MT5 terminal configuration

    Returns:
        Configured Flask application
    """
    app = Flask(__name__)

    # Enable CORS
    CORS(app)

    # Register blueprints
    app.register_blueprint(indicators_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(cron_bp)

    # Initialize MT5 connection pool
    with app.app_context():
        init_connection_pool(config_path)
        start_health_monitor()

        # Start APScheduler
        start_scheduler()

    # Register shutdown handlers
    atexit.register(shutdown_connection_pool)
    atexit.register(stop_health_monitor)
    atexit.register(stop_scheduler)

    return app
```

---

## Database Integration

### Job History Table Migration

**File: `migrations/add_job_history_table.sql`**

```sql
-- Create cron job execution history table
-- This table stores execution logs for monitoring and debugging

CREATE TABLE IF NOT EXISTS cron_job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'missed')),
    duration_ms INTEGER,
    result JSONB,
    error TEXT,
    traceback TEXT,
    scheduled_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by job_id
CREATE INDEX idx_cron_job_runs_job_id ON cron_job_runs(job_id);

-- Index for querying by status
CREATE INDEX idx_cron_job_runs_status ON cron_job_runs(status);

-- Index for time-based queries
CREATE INDEX idx_cron_job_runs_created_at ON cron_job_runs(created_at DESC);

-- Cleanup old records (keep 30 days)
-- Run this as a scheduled job or use pg_cron
CREATE OR REPLACE FUNCTION cleanup_old_job_runs()
RETURNS void AS $$
BEGIN
    DELETE FROM cron_job_runs WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- APScheduler will auto-create its job store table (apscheduler_jobs)
-- when first initialized with SQLAlchemyJobStore
```

### Prisma Schema Updates (Next.js Side)

If you need to query job history from Next.js:

```prisma
// Add to schema.prisma

model CronJobRun {
  id            String   @id @default(uuid())
  jobId         String   @map("job_id")
  status        String   // success, error, missed
  durationMs    Int?     @map("duration_ms")
  result        Json?
  error         String?
  traceback     String?
  scheduledTime DateTime? @map("scheduled_time")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([jobId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("cron_job_runs")
}
```

---

## API Communication

### Flask → Next.js API Calls

For jobs that need to call Next.js APIs:

```python
# app/services/nextjs_client.py

import os
import requests
from typing import Optional, Dict, Any


class NextJSClient:
    """
    HTTP client for calling Next.js API endpoints from Flask jobs.
    """

    def __init__(self):
        self.base_url = os.environ.get('NEXTJS_API_URL', 'https://your-app.vercel.app')
        self.api_key = os.environ.get('INTERNAL_API_KEY')
        self.timeout = 30  # seconds

    def _headers(self) -> Dict[str, str]:
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def get(self, path: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make GET request to Next.js API."""
        response = requests.get(
            f'{self.base_url}{path}',
            headers=self._headers(),
            params=params,
            timeout=self.timeout
        )
        response.raise_for_status()
        return response.json()

    def post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make POST request to Next.js API."""
        response = requests.post(
            f'{self.base_url}{path}',
            headers=self._headers(),
            json=data,
            timeout=self.timeout
        )
        response.raise_for_status()
        return response.json()


# Singleton instance
_client = None

def get_nextjs_client() -> NextJSClient:
    global _client
    if _client is None:
        _client = NextJSClient()
    return _client
```

### Usage in Jobs

```python
# Example: Sending notification via Next.js API

from app.services.nextjs_client import get_nextjs_client

def send_renewal_reminder(user_id: str, email: str):
    """Send renewal reminder email via Next.js email service."""
    client = get_nextjs_client()

    try:
        client.post('/api/internal/send-email', {
            'template': 'subscription-expiring',
            'to': email,
            'data': {
                'user_id': user_id,
                'days_remaining': 3
            }
        })
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
```

---

## Monitoring & Alerting

### Health Dashboard Endpoint

```python
# Add to app/routes/cron.py

@cron_bp.route('/dashboard', methods=['GET'])
@require_cron_secret
def dashboard():
    """
    GET /api/cron/dashboard

    Dashboard data for monitoring UI.
    """
    from app import db

    scheduler = get_scheduler()

    # Get job statistics for last 24 hours
    stats = db.session.execute("""
        SELECT
            job_id,
            COUNT(*) as total_runs,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
            AVG(duration_ms) as avg_duration_ms,
            MAX(created_at) as last_run
        FROM cron_job_runs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY job_id
    """).fetchall()

    job_stats = {}
    for row in stats:
        job_stats[row.job_id] = {
            'total_runs': row.total_runs,
            'successes': row.successes,
            'errors': row.errors,
            'success_rate': f"{(row.successes / row.total_runs * 100):.1f}%" if row.total_runs > 0 else "N/A",
            'avg_duration_ms': int(row.avg_duration_ms) if row.avg_duration_ms else 0,
            'last_run': row.last_run.isoformat() if row.last_run else None
        }

    # Get recent errors
    recent_errors = db.session.execute("""
        SELECT job_id, error, created_at
        FROM cron_job_runs
        WHERE status = 'error'
        ORDER BY created_at DESC
        LIMIT 10
    """).fetchall()

    return jsonify({
        'scheduler': {
            'running': scheduler.running,
            'job_count': len(scheduler.get_jobs())
        },
        'jobs': [
            {
                'id': job.id,
                'name': job.name,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                'stats': job_stats.get(job.id, {})
            }
            for job in scheduler.get_jobs()
        ],
        'recent_errors': [
            {
                'job_id': row.job_id,
                'error': row.error,
                'time': row.created_at.isoformat()
            }
            for row in recent_errors
        ]
    })
```

### Alerting Integration

````python
# app/services/alerting.py

import os
import requests
from typing import Optional


def send_alert(
    title: str,
    message: str,
    severity: str = 'warning',  # info, warning, error, critical
    job_id: Optional[str] = None
):
    """
    Send alert to monitoring service.

    Supports:
    - Slack webhook
    - Discord webhook
    - PagerDuty (for critical)
    """
    slack_webhook = os.environ.get('SLACK_WEBHOOK_URL')
    discord_webhook = os.environ.get('DISCORD_WEBHOOK_URL')

    color_map = {
        'info': '#36a64f',
        'warning': '#ff9800',
        'error': '#f44336',
        'critical': '#9c27b0'
    }

    # Send to Slack
    if slack_webhook:
        try:
            requests.post(slack_webhook, json={
                'attachments': [{
                    'color': color_map.get(severity, '#808080'),
                    'title': f"[{severity.upper()}] {title}",
                    'text': message,
                    'fields': [
                        {'title': 'Job ID', 'value': job_id or 'N/A', 'short': True},
                        {'title': 'Environment', 'value': os.environ.get('ENV', 'production'), 'short': True}
                    ]
                }]
            })
        except Exception as e:
            print(f"Failed to send Slack alert: {e}")

    # Send to Discord
    if discord_webhook:
        try:
            requests.post(discord_webhook, json={
                'embeds': [{
                    'title': f"[{severity.upper()}] {title}",
                    'description': message,
                    'color': int(color_map.get(severity, '#808080').replace('#', ''), 16)
                }]
            })
        except Exception as e:
            print(f"Failed to send Discord alert: {e}")


# Update job event listeners to send alerts on errors
def on_job_error(event):
    """Enhanced error handler with alerting."""
    from app.scheduler.manager import log_job_run
    import traceback

    error_msg = str(event.exception)
    tb = traceback.format_exc()

    # Log to database
    log_job_run(
        job_id=event.job_id,
        status='error',
        error=error_msg,
        traceback=tb
    )

    # Send alert
    send_alert(
        title=f"Cron Job Failed: {event.job_id}",
        message=f"Error: {error_msg}\n\nTraceback:\n```{tb}```",
        severity='error',
        job_id=event.job_id
    )
````

---

## Railway Deployment

### Railway Configuration

**railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "python run.py",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Updated Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/health || exit 1

# Run the application
CMD ["python", "run.py"]
```

### Updated requirements.txt

```
Flask==3.0.0
Flask-CORS==4.0.0
Flask-SQLAlchemy==3.1.0
python-dotenv==1.0.0
MetaTrader5==5.0.45
pandas>=2.0.0
APScheduler==3.10.4
SQLAlchemy==2.0.23
psycopg2-binary==2.9.9
requests==2.31.0
```

### Railway Environment Variables

```
# Existing
MT5_CONFIG_PATH=config/mt5_terminals.json
FLASK_PORT=5001
MT5_API_KEY=your-api-key
MT5_ADMIN_API_KEY=your-admin-api-key
HEALTH_CHECK_INTERVAL=60

# New for APScheduler
DATABASE_URL=postgresql://...  # Railway PostgreSQL URL
CRON_SECRET=your-cron-secret
NEXTJS_API_URL=https://your-app.vercel.app
INTERNAL_API_KEY=your-internal-api-key

# Optional: Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Railway Pro Plan Benefits

| Feature       | Hobby Plan | Pro Plan       |
| ------------- | ---------- | -------------- |
| **Uptime**    | May sleep  | Always running |
| **Instances** | 1          | Unlimited      |
| **Memory**    | 512MB      | 8GB+           |
| **CPU**       | Shared     | Dedicated      |
| **Support**   | Community  | Priority       |

**Critical**: APScheduler requires always-on hosting. Railway Pro Plan guarantees this.

---

## Migration Steps

### Pre-Migration Checklist

- [ ] Railway Pro Plan activated
- [ ] PostgreSQL database provisioned on Railway
- [ ] Environment variables configured
- [ ] APScheduler dependencies added to requirements.txt
- [ ] Job history migration run
- [ ] Alerting webhooks configured (optional)

### Step-by-Step Migration

#### Step 1: Prepare Flask Backend

```bash
# 1. Add new dependencies
echo "APScheduler==3.10.4" >> mt5-service/requirements.txt
echo "SQLAlchemy==2.0.23" >> mt5-service/requirements.txt
echo "psycopg2-binary==2.9.9" >> mt5-service/requirements.txt

# 2. Create new directories
mkdir -p mt5-service/app/scheduler
mkdir -p mt5-service/app/jobs
mkdir -p mt5-service/migrations

# 3. Add all new files (scheduler, jobs, routes)
# Copy files from Phase 1-4 above
```

#### Step 2: Run Database Migration

```bash
# Connect to Railway PostgreSQL
railway run psql

# Run migration
\i migrations/add_job_history_table.sql
```

#### Step 3: Test Locally

```bash
cd mt5-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set test environment variables
export DATABASE_URL="postgresql://localhost/test"
export CRON_SECRET="test-secret"

# Start Flask with scheduler
python run.py

# In another terminal, test endpoints
curl http://localhost:5001/api/cron/health
curl -H "Authorization: Bearer test-secret" http://localhost:5001/api/cron/jobs
```

#### Step 4: Deploy to Railway

```bash
# Push to Railway
railway up

# Verify deployment
railway logs

# Test production endpoints
curl https://your-service.railway.app/api/cron/health
```

#### Step 5: Disable Vercel Crons

Once Flask crons are working:

```json
// vercel.json - Remove all crons
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": []
}
```

#### Step 6: Monitor for 48 Hours

- Watch job execution in Railway logs
- Check job history table for errors
- Verify all scheduled times are correct
- Confirm alerting works (trigger a test error)

---

## Rollback Plan

If issues occur after migration:

### Immediate Rollback (< 5 minutes)

1. Re-enable Vercel crons in vercel.json
2. Push to Vercel
3. Jobs resume on Vercel

### Flask Scheduler Rollback

```python
# Stop scheduler without removing jobs
from app.scheduler.manager import stop_scheduler

stop_scheduler()  # Jobs stop but definitions remain in PostgreSQL
```

### Full Rollback

1. Revert vercel.json to original cron configuration
2. Deploy to Vercel
3. Keep Flask scheduler stopped but code intact
4. Investigate issues before retry

---

## Cost Analysis

### Current Costs (Vercel Only)

| Item                             | Cost      |
| -------------------------------- | --------- |
| Vercel Hobby                     | $0/month  |
| Vercel Pro (if needed for crons) | $20/month |

### Post-Migration Costs (Railway)

| Item                     | Cost                     |
| ------------------------ | ------------------------ |
| Railway Pro              | $5/month base + usage    |
| PostgreSQL (shared)      | Included                 |
| Compute (~$0.000463/min) | ~$20/month for always-on |
| **Total**                | ~$25/month               |

### Cost Comparison

| Scenario  | Vercel + Railway Hobby | Vercel + Railway Pro |
| --------- | ---------------------- | -------------------- |
| 2 crons   | $0                     | $25                  |
| 5 crons   | $20 (Vercel Pro)       | $25                  |
| 10+ crons | $20 (Vercel Pro limit) | $25 (unlimited)      |

**Break-even**: Railway Pro is cost-effective when you need >2 crons with advanced features.

---

## Risk Assessment

### High Risk

| Risk                 | Mitigation                                    |
| -------------------- | --------------------------------------------- |
| Railway downtime     | Health checks, alerting, Vercel cron fallback |
| Job store corruption | Regular PostgreSQL backups                    |
| Scheduler crash      | Auto-restart via Railway, job persistence     |

### Medium Risk

| Risk                     | Mitigation                                    |
| ------------------------ | --------------------------------------------- |
| Missed jobs              | Misfire grace time (1 hour), coalesce enabled |
| Database connection loss | Connection pooling, retry logic               |
| Memory issues            | Monitor usage, scale if needed                |

### Low Risk

| Risk                 | Mitigation                                 |
| -------------------- | ------------------------------------------ |
| Time zone issues     | All times in UTC, explicit timezone config |
| Concurrent execution | max_instances=1 per job                    |
| Job conflicts        | Sequential scheduling (5 minute gaps)      |

---

## Summary

### When to Migrate

Migrate to Flask APScheduler when:

- ✅ You have Railway Pro Plan (always-on guarantee)
- ✅ You need more than 2 cron jobs
- ✅ You need advanced features (retries, persistence, monitoring)
- ✅ You want centralized job management

### Key Benefits

1. **Unlimited cron jobs** - No Vercel limits
2. **Job persistence** - Survives restarts
3. **Built-in monitoring** - Dashboard, history, alerting
4. **Advanced scheduling** - Interval, date triggers
5. **Retry logic** - Automatic misfire handling
6. **Centralized control** - All jobs in one place

### Implementation Effort

| Phase                             | Files    | Effort    |
| --------------------------------- | -------- | --------- |
| Phase 1: Scheduler Infrastructure | 2        | 2 hours   |
| Phase 2: Job Implementations      | 5        | 3 hours   |
| Phase 3: API Routes               | 1        | 2 hours   |
| Phase 4: App Integration          | 1        | 1 hour    |
| Phase 5: Database Migration       | 1        | 30 min    |
| Phase 6: Deployment & Testing     | -        | 2 hours   |
| **Total**                         | 10 files | ~10 hours |

---

**Document Status:** Ready for Implementation Post-MVP
**Next Action:** Upgrade to Railway Pro Plan, then execute migration steps
**Questions?** Review Railway Pro Plan features at https://railway.app/pricing
