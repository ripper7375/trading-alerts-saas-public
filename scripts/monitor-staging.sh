#!/bin/bash

# Staging Health Monitor
# Purpose: Quick health check for staging environment
# Usage: ./monitor-staging.sh

# Configuration
STAGING_URL="https://trading-alerts-saas-public-go8p.vercel.app"

echo "========================================="
echo "Staging Health Monitor"
echo "Time: $(date)"
echo "========================================="
echo ""

# Health check
echo "1. Health Check:"
HEALTH_STATUS=$(curl -s "$STAGING_URL/api/health" 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ -z "$HEALTH_STATUS" ]; then
    echo "   âŒ FAILED - Cannot reach health endpoint"
else
    echo "   âœ… Status: $HEALTH_STATUS"
fi

# PostgreSQL check
echo ""
echo "2. PostgreSQL Connection:"
PG_STATUS=$(curl -s "$STAGING_URL/api/health" 2>/dev/null | grep -o '"postgresql":{[^}]*}')
if [ -z "$PG_STATUS" ]; then
    echo "   âš ï¸ WARNING - Cannot retrieve PostgreSQL status"
else
    echo "   âœ… Connected"
fi

# Redis check
echo ""
echo "3. Redis Connection:"
REDIS_STATUS=$(curl -s "$STAGING_URL/api/health" 2>/dev/null | grep -o '"redis":{[^}]*}')
if [ -z "$REDIS_STATUS" ]; then
    echo "   âš ï¸ WARNING - Cannot retrieve Redis status"
else
    echo "   âœ… Connected"
fi

# Data availability check
echo ""
echo "4. Sample Data Check:"

# Test EURUSD H1
EURUSD_STATUS=$(curl -s "$STAGING_URL/api/indicators/EURUSD/H1" 2>/dev/null | grep -o '"success":[^,]*' | cut -d':' -f2)
if [ "$EURUSD_STATUS" = "true" ]; then
    echo "   âœ… EURUSD H1 data available"
else
    echo "   âŒ EURUSD H1 data NOT available"
fi

# Test BTCUSD H1
BTCUSD_STATUS=$(curl -s "$STAGING_URL/api/indicators/BTCUSD/H1" 2>/dev/null | grep -o '"success":[^,]*' | cut -d':' -f2)
if [ "$BTCUSD_STATUS" = "true" ]; then
    echo "   âœ… BTCUSD H1 data available"
else
    echo "   âŒ BTCUSD H1 data NOT available"
fi

# Test USDJPY H1
USDJPY_STATUS=$(curl -s "$STAGING_URL/api/indicators/USDJPY/H1" 2>/dev/null | grep -o '"success":[^,]*' | cut -d':' -f2)
if [ "$USDJPY_STATUS" = "true" ]; then
    echo "   âœ… USDJPY H1 data available"
else
    echo "   âŒ USDJPY H1 data NOT available"
fi

echo ""
echo "========================================="
echo "Monitoring Complete"
echo "========================================="
