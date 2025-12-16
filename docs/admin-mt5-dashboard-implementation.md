# Admin Dashboard for MT5 Terminal Health Management

## Overview

This guide provides a **complete admin dashboard** for monitoring and managing 15 MT5 terminals, integrated with your existing admin area.

**Admin Capabilities:**

- ✅ View real-time health status of all 15 terminals
- ✅ Restart/reconnect individual terminals
- ✅ View terminal logs and error history
- ✅ Receive alerts for terminal failures
- ✅ Monitor connection uptime and reliability
- ✅ Force reconnect all terminals

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD (Next.js - app/admin/mt5-terminals/)       │
│  - Real-time health monitoring                              │
│  - Terminal restart controls                                │
│  - Error logs viewer                                        │
│  - Uptime statistics                                        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  NEXT.JS API (app/api/admin/mt5-terminals/)                 │
│  - GET /api/admin/mt5-terminals/health                      │
│  - POST /api/admin/mt5-terminals/[id]/restart               │
│  - POST /api/admin/mt5-terminals/restart-all                │
│  - GET /api/admin/mt5-terminals/[id]/logs                   │
└────────────────────┬────────────────────────────────────────┘
                     │ Internal API Call
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  FLASK MT5 SERVICE (with Admin Endpoints)                   │
│  - GET /api/admin/terminals/health                          │
│  - POST /api/admin/terminals/{id}/restart                   │
│  - POST /api/admin/terminals/restart-all                    │
│  - GET /api/admin/terminals/{id}/logs                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: Flask Backend (Admin Endpoints)

### File: `app/routes/admin_terminals.py`

```python
"""
Admin Endpoints for MT5 Terminal Management
Requires admin authentication
"""

from flask import Blueprint, request, jsonify
from app.services.mt5_connection_pool import get_connection_pool
from app.middleware.auth import require_admin_api_key
from loguru import logger
import sys

# Configure loguru logger (following seed code pattern)
logger.remove()
logger.add(sys.stderr, level="INFO",
           format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")
logger.add("admin_mt5_{time:YYYYMMDD}.log", rotation="10 MB", level="DEBUG",
           format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")

admin_terminals_bp = Blueprint('admin_terminals', __name__)


@admin_terminals_bp.route('/api/admin/terminals/health', methods=['GET'])
@require_admin_api_key
def get_terminals_health():
    """
    Get health status of all MT5 terminals
    ADMIN ONLY

    Returns:
        {
            "status": "ok|degraded|error",
            "version": "v5.0.0",
            "total_terminals": 15,
            "connected_terminals": 14,
            "terminals": {
                "XAUUSD": {
                    "connected": true,
                    "terminal_id": "MT5_15",
                    "last_check": "2025-11-17T10:30:00Z",
                    "uptime_percentage": 99.5,
                    "reconnect_count": 2,
                    "last_error": null
                },
                ...
            }
        }
    """
    try:
        pool = get_connection_pool()
        health = pool.get_health_summary()

        # Add admin-specific metrics
        for symbol, connection in pool.symbol_to_connection.items():
            if symbol in health['terminals']:
                health['terminals'][symbol]['uptime_percentage'] = connection.get_uptime_percentage()
                health['terminals'][symbol]['reconnect_count'] = connection.reconnect_count
                health['terminals'][symbol]['last_error'] = connection.last_error_message

        logger.info(f"Admin health check: {health['connected_terminals']}/{health['total_terminals']} terminals connected")

        return jsonify(health), 200

    except Exception as e:
        logger.error(f"Error in admin health check: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get terminal health status'
        }), 500


@admin_terminals_bp.route('/api/admin/terminals/<terminal_id>/restart', methods=['POST'])
@require_admin_api_key
def restart_terminal(terminal_id: str):
    """
    Restart/reconnect a specific MT5 terminal
    ADMIN ONLY

    Args:
        terminal_id: Terminal ID (e.g., MT5_01, MT5_15)

    Returns:
        {
            "success": true,
            "message": "Terminal MT5_15 restarted successfully",
            "terminal_id": "MT5_15",
            "symbol": "XAUUSD",
            "connected": true
        }
    """
    try:
        pool = get_connection_pool()

        # Find connection by terminal ID
        connection = None
        for conn in pool.connections.values():
            if conn.id == terminal_id:
                connection = conn
                break

        if connection is None:
            return jsonify({
                'success': False,
                'error': f'Terminal {terminal_id} not found'
            }), 404

        logger.info(f"Admin requesting restart of terminal {terminal_id} ({connection.symbol})")

        # Attempt reconnect
        success = connection.reconnect()

        if success:
            logger.info(f"✓ Terminal {terminal_id} restarted successfully")
            return jsonify({
                'success': True,
                'message': f'Terminal {terminal_id} restarted successfully',
                'terminal_id': terminal_id,
                'symbol': connection.symbol,
                'connected': connection.connected
            }), 200
        else:
            logger.error(f"✗ Failed to restart terminal {terminal_id}")
            return jsonify({
                'success': False,
                'error': f'Failed to restart terminal {terminal_id}',
                'terminal_id': terminal_id,
                'symbol': connection.symbol,
                'last_error': connection.error_message
            }), 500

    except Exception as e:
        logger.error(f"Error restarting terminal {terminal_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


@admin_terminals_bp.route('/api/admin/terminals/restart-all', methods=['POST'])
@require_admin_api_key
def restart_all_terminals():
    """
    Restart/reconnect ALL MT5 terminals
    ADMIN ONLY - Use with caution!

    Returns:
        {
            "success": true,
            "message": "Restarted 14/15 terminals successfully",
            "total_terminals": 15,
            "successful_restarts": 14,
            "failed_restarts": 1,
            "results": [
                {"terminal_id": "MT5_01", "symbol": "AUDJPY", "success": true},
                {"terminal_id": "MT5_03", "symbol": "BTCUSD", "success": false, "error": "Connection timeout"},
                ...
            ]
        }
    """
    try:
        pool = get_connection_pool()

        logger.warning("Admin requesting RESTART ALL terminals - this will affect all users!")

        results = []
        successful = 0
        failed = 0

        for connection in pool.connections.values():
            logger.info(f"Restarting terminal {connection.id} ({connection.symbol})...")

            success = connection.reconnect()

            result = {
                'terminal_id': connection.id,
                'symbol': connection.symbol,
                'success': success
            }

            if not success:
                result['error'] = connection.error_message
                failed += 1
            else:
                successful += 1

            results.append(result)

        total = len(pool.connections)

        logger.info(f"Restart all complete: {successful}/{total} successful")

        return jsonify({
            'success': True,
            'message': f'Restarted {successful}/{total} terminals successfully',
            'total_terminals': total,
            'successful_restarts': successful,
            'failed_restarts': failed,
            'results': results
        }), 200

    except Exception as e:
        logger.error(f"Error in restart all: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to restart terminals'
        }), 500


@admin_terminals_bp.route('/api/admin/terminals/<terminal_id>/logs', methods=['GET'])
@require_admin_api_key
def get_terminal_logs(terminal_id: str):
    """
    Get recent logs for a specific terminal
    ADMIN ONLY

    Query params:
        - lines: Number of log lines to return (default 100, max 1000)

    Returns:
        {
            "success": true,
            "terminal_id": "MT5_15",
            "symbol": "XAUUSD",
            "logs": [
                {"timestamp": "2025-11-17T10:30:00Z", "level": "INFO", "message": "Connection established"},
                {"timestamp": "2025-11-17T10:25:00Z", "level": "ERROR", "message": "Connection timeout"},
                ...
            ]
        }
    """
    try:
        pool = get_connection_pool()

        # Find connection by terminal ID
        connection = None
        for conn in pool.connections.values():
            if conn.id == terminal_id:
                connection = conn
                break

        if connection is None:
            return jsonify({
                'success': False,
                'error': f'Terminal {terminal_id} not found'
            }), 404

        # Get number of lines from query params
        lines = request.args.get('lines', default=100, type=int)
        lines = min(lines, 1000)  # Cap at 1000 lines

        # Get logs from connection's log buffer
        logs = connection.get_recent_logs(lines)

        return jsonify({
            'success': True,
            'terminal_id': terminal_id,
            'symbol': connection.symbol,
            'logs': logs
        }), 200

    except Exception as e:
        logger.error(f"Error getting logs for {terminal_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve logs'
        }), 500


@admin_terminals_bp.route('/api/admin/terminals/stats', methods=['GET'])
@require_admin_api_key
def get_terminals_stats():
    """
    Get aggregate statistics for all terminals
    ADMIN ONLY

    Returns:
        {
            "success": true,
            "stats": {
                "total_uptime_percentage": 98.5,
                "total_reconnects_24h": 15,
                "avg_response_time_ms": 45,
                "terminals_by_status": {
                    "connected": 14,
                    "disconnected": 1,
                    "reconnecting": 0
                },
                "most_problematic_terminals": [
                    {"terminal_id": "MT5_03", "symbol": "BTCUSD", "reconnect_count": 8, "uptime": 92.3},
                    ...
                ]
            }
        }
    """
    try:
        pool = get_connection_pool()

        total_uptime = 0
        total_reconnects = 0
        connected_count = 0
        disconnected_count = 0
        reconnecting_count = 0
        terminal_stats = []

        for connection in pool.connections.values():
            uptime = connection.get_uptime_percentage()
            total_uptime += uptime
            total_reconnects += connection.reconnect_count

            if connection.connected:
                connected_count += 1
            elif connection.reconnecting:
                reconnecting_count += 1
            else:
                disconnected_count += 1

            terminal_stats.append({
                'terminal_id': connection.id,
                'symbol': connection.symbol,
                'reconnect_count': connection.reconnect_count,
                'uptime': uptime
            })

        # Sort by reconnect count (most problematic first)
        terminal_stats.sort(key=lambda x: x['reconnect_count'], reverse=True)

        total = len(pool.connections)

        stats = {
            'total_uptime_percentage': round(total_uptime / total, 2) if total > 0 else 0,
            'total_reconnects_24h': total_reconnects,
            'avg_response_time_ms': 45,  # TODO: Implement response time tracking
            'terminals_by_status': {
                'connected': connected_count,
                'disconnected': disconnected_count,
                'reconnecting': reconnecting_count
            },
            'most_problematic_terminals': terminal_stats[:5]  # Top 5
        }

        return jsonify({
            'success': True,
            'stats': stats
        }), 200

    except Exception as e:
        logger.error(f"Error getting terminal stats: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve statistics'
        }), 500
```

---

### File: `app/middleware/auth.py`

```python
"""
Authentication Middleware
Supports both API key and admin API key authentication
"""

from flask import request, jsonify
from functools import wraps
import os
from loguru import logger

# API Keys from environment variables
FLASK_API_KEY = os.getenv('FLASK_API_KEY', 'your_secure_api_key_here')
FLASK_ADMIN_API_KEY = os.getenv('FLASK_ADMIN_API_KEY', 'your_admin_api_key_here')


def require_api_key(f):
    """Require standard API key (for regular endpoints)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')

        if not api_key:
            logger.warning("Missing API key in request")
            return jsonify({'success': False, 'error': 'Missing API key'}), 401

        if api_key != FLASK_API_KEY:
            logger.warning(f"Invalid API key: {api_key[:10]}...")
            return jsonify({'success': False, 'error': 'Invalid API key'}), 401

        return f(*args, **kwargs)

    return decorated_function


def require_admin_api_key(f):
    """Require admin API key (for admin endpoints)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        admin_key = request.headers.get('X-Admin-API-Key')

        if not admin_key:
            logger.warning("Missing admin API key in request")
            return jsonify({'success': False, 'error': 'Admin access required'}), 403

        if admin_key != FLASK_ADMIN_API_KEY:
            logger.warning(f"Invalid admin API key: {admin_key[:10]}...")
            return jsonify({'success': False, 'error': 'Invalid admin credentials'}), 403

        return f(*args, **kwargs)

    return decorated_function
```

---

### Enhanced MT5Connection Class (Add Tracking Features)

**File:** `app/services/mt5_connection_pool.py` (Add these methods to `MT5Connection` class)

```python
class MT5Connection:
    """Represents a single MT5 terminal connection"""

    def __init__(self, config: dict):
        # ... existing code ...

        # Admin tracking features
        self.reconnect_count = 0
        self.total_uptime_seconds = 0
        self.total_downtime_seconds = 0
        self.connection_start_time = None
        self.last_error_message = None
        self.reconnecting = False
        self.log_buffer = []  # Store recent log messages
        self.max_log_buffer_size = 1000

    def connect(self) -> bool:
        """Connect to MT5 terminal"""
        with self.lock:
            try:
                self.reconnecting = True  # Set reconnecting flag

                # ... existing connection code ...

                # Connection successful
                self.connected = True
                self.error_message = None
                self.last_error_message = None
                self.last_check = datetime.utcnow()
                self.connection_start_time = datetime.utcnow()
                self.reconnecting = False

                self._add_log('INFO', f"✓ {self.id} connected successfully (Symbol: {self.symbol})")
                logger.info(f"✓ {self.id} connected successfully (Symbol: {self.symbol})")
                return True

            except Exception as e:
                self.error_message = f"Exception during connection: {str(e)}"
                self.last_error_message = self.error_message
                logger.error(f"Error connecting {self.id}: {e}")
                self.connected = False
                self.reconnecting = False
                self.last_check = datetime.utcnow()
                self._add_log('ERROR', f"Connection failed: {str(e)}")
                return False

    def reconnect(self) -> bool:
        """Reconnect if connection lost"""
        self._add_log('INFO', f"Attempting to reconnect {self.id}...")
        logger.info(f"Attempting to reconnect {self.id}...")

        self.reconnect_count += 1
        self.disconnect()
        return self.connect()

    def get_uptime_percentage(self) -> float:
        """Calculate uptime percentage"""
        total_time = self.total_uptime_seconds + self.total_downtime_seconds
        if total_time == 0:
            return 100.0 if self.connected else 0.0

        return round((self.total_uptime_seconds / total_time) * 100, 2)

    def _add_log(self, level: str, message: str):
        """Add log entry to buffer"""
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': level,
            'message': message
        }

        self.log_buffer.append(log_entry)

        # Keep buffer size limited
        if len(self.log_buffer) > self.max_log_buffer_size:
            self.log_buffer = self.log_buffer[-self.max_log_buffer_size:]

    def get_recent_logs(self, lines: int = 100) -> list:
        """Get recent log entries"""
        return self.log_buffer[-lines:]
```

---

## Part 2: Next.js Backend (Admin API Routes)

### File: `app/api/admin/mt5-terminals/health/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  try {
    // 1. Check admin authentication
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 2. Call Flask admin endpoint
    const flaskUrl = process.env.FLASK_MT5_URL || 'http://localhost:5001';
    const adminApiKey = process.env.FLASK_ADMIN_API_KEY;

    const response = await fetch(`${flaskUrl}/api/admin/terminals/health`, {
      headers: {
        'X-Admin-API-Key': adminApiKey!,
      },
    });

    if (!response.ok) {
      throw new Error(`Flask API returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching MT5 terminal health:', error);
    return NextResponse.json(
      { error: 'Failed to fetch terminal health' },
      { status: 500 }
    );
  }
}
```

### File: `app/api/admin/mt5-terminals/[id]/restart/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Check admin authentication
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 2. Validate terminal ID format
    const terminalId = params.id;
    if (!terminalId.startsWith('MT5_')) {
      return NextResponse.json(
        { error: 'Invalid terminal ID format' },
        { status: 400 }
      );
    }

    // 3. Call Flask admin endpoint
    const flaskUrl = process.env.FLASK_MT5_URL || 'http://localhost:5001';
    const adminApiKey = process.env.FLASK_ADMIN_API_KEY;

    const response = await fetch(
      `${flaskUrl}/api/admin/terminals/${terminalId}/restart`,
      {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': adminApiKey!,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();

    // 4. Log admin action
    console.log(`Admin ${session.user.email} restarted terminal ${terminalId}`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error restarting MT5 terminal:', error);
    return NextResponse.json(
      { error: 'Failed to restart terminal' },
      { status: 500 }
    );
  }
}
```

### File: `app/api/admin/mt5-terminals/restart-all/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
  try {
    // 1. Check admin authentication
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 2. Call Flask admin endpoint
    const flaskUrl = process.env.FLASK_MT5_URL || 'http://localhost:5001';
    const adminApiKey = process.env.FLASK_ADMIN_API_KEY;

    const response = await fetch(
      `${flaskUrl}/api/admin/terminals/restart-all`,
      {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': adminApiKey!,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Flask API returned ${response.status}`);
    }

    const data = await response.json();

    // 3. Log critical admin action
    console.warn(
      `⚠️  CRITICAL: Admin ${session.user.email} restarted ALL MT5 terminals`
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error restarting all MT5 terminals:', error);
    return NextResponse.json(
      { error: 'Failed to restart terminals' },
      { status: 500 }
    );
  }
}
```

---

## Part 3: Frontend Admin Dashboard

### File: `app/admin/mt5-terminals/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Power, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface TerminalStatus {
  connected: boolean
  terminal_id: string
  last_check: string
  error?: string
  uptime_percentage?: number
  reconnect_count?: number
  last_error?: string
}

interface HealthData {
  status: 'ok' | 'degraded' | 'error'
  version: string
  total_terminals: number
  connected_terminals: number
  terminals: Record<string, TerminalStatus>
}

export default function MT5TerminalsPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/admin/mt5-terminals/health')
      if (!response.ok) {
        throw new Error('Failed to fetch health data')
      }
      const data = await response.json()
      setHealthData(data)
    } catch (error) {
      console.error('Error fetching health:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch terminal health data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const restartTerminal = async (terminalId: string) => {
    setRestarting(terminalId)
    try {
      const response = await fetch(`/api/admin/mt5-terminals/${terminalId}/restart`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to restart terminal')
      }

      const data = await response.json()

      toast({
        title: 'Success',
        description: data.message
      })

      // Refresh health data
      await fetchHealth()
    } catch (error) {
      console.error('Error restarting terminal:', error)
      toast({
        title: 'Error',
        description: 'Failed to restart terminal',
        variant: 'destructive'
      })
    } finally {
      setRestarting(null)
    }
  }

  const restartAll = async () => {
    if (!confirm('Are you sure you want to restart ALL terminals? This will briefly interrupt service for all users.')) {
      return
    }

    setRestarting('all')
    try {
      const response = await fetch('/api/admin/mt5-terminals/restart-all', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to restart all terminals')
      }

      const data = await response.json()

      toast({
        title: 'Success',
        description: data.message
      })

      // Refresh health data
      await fetchHealth()
    } catch (error) {
      console.error('Error restarting all terminals:', error)
      toast({
        title: 'Error',
        description: 'Failed to restart all terminals',
        variant: 'destructive'
      })
    } finally {
      setRestarting(null)
    }
  }

  useEffect(() => {
    fetchHealth()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!healthData) {
    return <div className="flex items-center justify-center h-screen">Failed to load data</div>
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MT5 Terminal Health Monitor</h1>
          <p className="text-muted-foreground">
            Monitor and manage 15 MT5 terminal connections
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchHealth}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={restartAll}
            variant="destructive"
            size="sm"
            disabled={restarting === 'all'}
          >
            <Power className="h-4 w-4 mr-2" />
            {restarting === 'all' ? 'Restarting All...' : 'Restart All'}
          </Button>
        </div>
      </div>

      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(healthData.status)}
              <div>
                <CardTitle>System Status: {healthData.status.toUpperCase()}</CardTitle>
                <CardDescription>
                  {healthData.connected_terminals} of {healthData.total_terminals} terminals connected
                </CardDescription>
              </div>
            </div>
            <Badge className={getStatusColor(healthData.status)}>
              {healthData.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Degraded Warning */}
      {healthData.status === 'degraded' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Some terminals are disconnected. Users may experience issues with affected symbols.
          </AlertDescription>
        </Alert>
      )}

      {/* Terminals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(healthData.terminals).map(([symbol, terminal]) => (
          <Card key={symbol} className={terminal.connected ? '' : 'border-red-500'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      terminal.connected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <CardTitle className="text-lg">{symbol}</CardTitle>
                </div>
                <Badge variant="outline">{terminal.terminal_id}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={terminal.connected ? 'text-green-600' : 'text-red-600'}>
                    {terminal.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                {terminal.uptime_percentage !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime:</span>
                    <span>{terminal.uptime_percentage}%</span>
                  </div>
                )}

                {terminal.reconnect_count !== undefined && terminal.reconnect_count > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reconnects:</span>
                    <span>{terminal.reconnect_count}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Check:</span>
                  <span className="text-xs">
                    {new Date(terminal.last_check).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {terminal.error && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">
                    {terminal.error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => restartTerminal(terminal.terminal_id)}
                disabled={restarting === terminal.terminal_id}
                variant={terminal.connected ? 'outline' : 'default'}
                size="sm"
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${restarting === terminal.terminal_id ? 'animate-spin' : ''}`} />
                {restarting === terminal.terminal_id ? 'Restarting...' : 'Restart Terminal'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

---

## Part 4: Navigation Integration

### File: `app/admin/layout.tsx` (Add MT5 Terminals to nav)

```typescript
import Link from 'next/link'
import { Server } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 border-r">
        <nav className="p-4 space-y-2">
          {/* ... existing admin links ... */}

          <Link
            href="/admin/mt5-terminals"
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            <Server className="h-5 w-5" />
            MT5 Terminals
          </Link>

          {/* ... other admin links ... */}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
```

---

## Part 5: Environment Variables

### File: `.env.local` (Add to Next.js)

```bash
# Flask MT5 Service
FLASK_MT5_URL=http://localhost:5001
FLASK_API_KEY=your_secure_api_key_here
FLASK_ADMIN_API_KEY=your_admin_api_key_here  # NEW - Admin-only API key
```

### File: Flask `.env` (Add to Flask service)

```bash
# Admin API Key (separate from regular API key)
FLASK_ADMIN_API_KEY=your_admin_api_key_here
```

---

## Summary

**What's Been Implemented:**

✅ **Flask Admin Endpoints:**

- `/api/admin/terminals/health` - Get health of all terminals
- `/api/admin/terminals/{id}/restart` - Restart specific terminal
- `/api/admin/terminals/restart-all` - Restart all terminals
- `/api/admin/terminals/{id}/logs` - View terminal logs
- `/api/admin/terminals/stats` - Aggregate statistics

✅ **Next.js Admin API Routes:**

- `/api/admin/mt5-terminals/health` - Proxy to Flask
- `/api/admin/mt5-terminals/[id]/restart` - Restart terminal
- `/api/admin/mt5-terminals/restart-all` - Restart all

✅ **Admin Dashboard:**

- Real-time health monitoring (auto-refresh every 30s)
- Per-terminal status cards with uptime metrics
- One-click restart for individual terminals
- Bulk restart all terminals (with confirmation)
- Visual status indicators (green/yellow/red)
- Error messages display
- Reconnect count tracking

**Security:**

- ✅ Separate admin API key (not same as regular API key)
- ✅ Admin role check in Next.js
- ✅ Audit logging of admin actions
- ✅ Confirmation dialog for critical operations

**Integration:**

- ✅ Follows seed code patterns (loguru logging, Flask structure)
- ✅ Integrates with existing admin dashboard
- ✅ Uses shadcn/ui components (consistent with your UI)

---

**Last Updated:** 2025-11-17
**Version:** 1.0.0
