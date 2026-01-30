# Prompt 4: Basic Observability Implementation

## Context

I have uploaded two architecture documents:

1. `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md` - Complete API Gateway architecture
2. `API_GATEWAY_OBSERVABILITY_GUIDE.md` - Complete observability implementation guide

I need you to implement **Level 1 & Level 2 observability** (from the observability guide) for the Trading Alerts SaaS platform:

**Level 1: Basic Logging** (already partially implemented in prompts 1-3)

- Structured JSON logging
- Log aggregation via Railway

**Level 2: Metrics Dashboard** (main focus of this prompt)

- Prometheus metrics collection
- Grafana dashboards
- Basic alerting

The system processes 12,000 bars/day from 15 MT5 terminals with a target 0.5% error rate.

## Requirements

### 1. Prometheus Setup on Railway

Provide complete Prometheus deployment:

**Option A: Standalone Prometheus Service**

```dockerfile
# Dockerfile for Prometheus on Railway
FROM prom/prometheus:latest

COPY prometheus.yml /etc/prometheus/
EXPOSE 9090

CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles"]
```

**Option B: Use Railway Template**

- Instructions to add Prometheus from Railway templates
- Configuration via environment variables

### 2. Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'railway-production'
    project: 'trading-alerts-saas'

scrape_configs:
  # API Gateway metrics
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway.railway.internal:3000']
    metrics_path: '/metrics'
    scheme: 'https'

  # Worker metrics
  - job_name: 'workers'
    static_configs:
      - targets: ['workers.railway.internal:3001']
    metrics_path: '/metrics'
    scheme: 'https'

# Alerting rules
rule_files:
  - 'alerts.yml'
# Alert manager (optional for Level 2)
# alerting:
#   alertmanagers:
#     - static_configs:
#         - targets: ['alertmanager:9093']
```

### 3. Alerting Rules

Create `alerts.yml`:

```yaml
groups:
  - name: api_gateway_alerts
    interval: 1m
    rules:
      # High error rate alert
      - alert: HighValidationErrorRate
        expr: rate(api_validation_errors_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High validation error rate detected'
          description: '{{ $value }} errors/min for 5 minutes'

      # API Gateway down
      - alert: APIGatewayDown
        expr: up{job="api-gateway"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'API Gateway is down'
          description: 'API Gateway has been down for 2 minutes'

      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, api_request_duration_seconds_bucket) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'API Gateway response time is high'
          description: 'P95 response time is {{ $value }}s'

  - name: worker_alerts
    interval: 1m
    rules:
      # Worker queue backup
      - alert: QueueBackup
        expr: queue_jobs_waiting > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Queue is backing up'
          description: '{{ $value }} jobs waiting in queue'

      # Worker down
      - alert: WorkerDown
        expr: up{job="workers"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'Worker is down'
          description: 'Worker has been down for 2 minutes'

      # High job failure rate
      - alert: HighJobFailureRate
        expr: rate(worker_jobs_failed_total[5m]) / rate(worker_jobs_success_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High job failure rate'
          description: '{{ $value | humanizePercentage }} of jobs are failing'
```

### 4. Grafana Setup on Railway

Provide Grafana deployment:

**Deployment:**

```dockerfile
# Dockerfile for Grafana on Railway
FROM grafana/grafana:latest

ENV GF_SECURITY_ADMIN_USER=admin
ENV GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
ENV GF_SERVER_ROOT_URL=https://${RAILWAY_PUBLIC_DOMAIN}

COPY provisioning/ /etc/grafana/provisioning/
EXPOSE 3000

CMD ["grafana-server", \
     "--homepath=/usr/share/grafana", \
     "--config=/etc/grafana/grafana.ini"]
```

**Or use Railway template:**

- Add Grafana from Railway templates
- Configure via environment variables

### 5. Grafana Datasource Configuration

Create `provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus.railway.internal:9090
    isDefault: true
    editable: true
```

### 6. Grafana Dashboard Configurations

Create 4 production-ready dashboards (provide complete JSON):

#### Dashboard 1: Validation Overview

**Panels:**

1. Error Rate (last 24h) - Line graph
2. Total Errors by Type - Pie chart
3. Errors by Terminal - Bar chart
4. Validation Layers Triggered - Pie chart
5. Success Rate - Gauge (target: 99.5%)

**JSON Template:**

```json
{
  "dashboard": {
    "title": "API Gateway - Validation Overview",
    "tags": ["trading-alerts", "validation"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Error Rate (last 24h)",
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "rate(api_validation_errors_total[5m]) * 60",
            "legendFormat": "Errors/min"
          }
        ]
      }
      // ... more panels
    ]
  }
}
```

#### Dashboard 2: Performance Metrics

**Panels:**

1. Request Duration (p50, p95, p99) - Line graph
2. Requests per Second - Line graph
3. Queue Size - Line graph
4. Database Connection Pool - Gauge

#### Dashboard 3: Terminal Health

**Panels:**

1. Error Rate by Terminal - Heatmap
2. Success Rate by Terminal - Table
3. Last Error by Terminal - Table
4. Request Count by Terminal - Bar chart

#### Dashboard 4: System Health

**Panels:**

1. Service Status (API Gateway, Workers, Redis, DB) - Stat panels
2. Total Requests (24h) - Stat
3. Total Errors (24h) - Stat
4. Current Queue Size - Stat
5. System Uptime - Stat

### 7. Logging Stack Configuration

#### Winston Logger Configuration

Create structured logging setup:

```typescript
// config/logger.config.ts
import * as winston from 'winston';

export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
};

// Production: Add file transport or external service
if (process.env.NODE_ENV === 'production') {
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}
```

#### Log Aggregation

Provide Railway logs access guide:

```bash
# View logs via Railway CLI
railway logs --service api-gateway --follow

# Filter logs
railway logs --service api-gateway --filter "Validation failed"

# Export logs
railway logs --service api-gateway --since 24h > logs_24h.txt

# Search specific error
railway logs --json | jq 'select(.errorType == "BadRequestException")'
```

### 8. Slack Integration (Optional Alert)

Provide Slack webhook integration:

```typescript
// monitoring/slack.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SlackService {
  private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL;

  async sendAlert(message: string, level: 'info' | 'warning' | 'error') {
    const colors = {
      info: '#36a64f',
      warning: '#ff9900',
      error: '#ff0000',
    };

    const payload = {
      attachments: [
        {
          color: colors[level],
          title: `[${level.toUpperCase()}] Trading Alerts SaaS`,
          text: message,
          footer: 'Monitoring System',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      await axios.post(this.webhookUrl, payload);
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  async sendDailySummary(stats: any) {
    const message = `
*Daily Summary*
Total Requests: ${stats.totalRequests}
Errors: ${stats.totalErrors} (${stats.errorRate}%)
Top Error: ${stats.topError}
Problematic Terminal: ${stats.worstTerminal}
    `;

    await this.sendAlert(message, 'info');
  }
}
```

### 9. Health Check Aggregator

Create unified health check endpoint:

```typescript
// monitoring/health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  async checkHealth() {
    const [apiGateway, workers, redis, database] = await Promise.all([
      this.checkAPIGateway(),
      this.checkWorkers(),
      this.checkRedis(),
      this.checkDatabase(),
    ]);

    const isHealthy = apiGateway && workers && redis && database;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      services: {
        apiGateway: { status: apiGateway ? 'up' : 'down' },
        workers: { status: workers ? 'up' : 'down' },
        redis: { status: redis ? 'up' : 'down' },
        database: { status: database ? 'up' : 'down' },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/metrics-summary')
  async getMetricsSummary() {
    // Return aggregated metrics from Prometheus
    return {
      last24h: {
        totalRequests: await this.getMetric('api_requests_total'),
        totalErrors: await this.getMetric('api_validation_errors_total'),
        errorRate: await this.getMetric(
          'rate(api_validation_errors_total[24h])'
        ),
        avgResponseTime: await this.getMetric(
          'histogram_quantile(0.5, api_request_duration_seconds_bucket)'
        ),
        queueSize: await this.getMetric('queue_jobs_waiting'),
      },
    };
  }
}
```

### 10. Monitoring Dashboard UI (Optional)

Provide simple HTML dashboard:

```html
<!-- public/monitoring.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>Trading Alerts - Monitoring</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  </head>
  <body>
    <h1>Trading Alerts Monitoring</h1>

    <div id="status">
      <h2>System Status</h2>
      <div id="services"></div>
    </div>

    <div id="metrics">
      <h2>Metrics (Last 24h)</h2>
      <canvas id="errorRateChart"></canvas>
    </div>

    <script>
      // Fetch health status
      fetch('/health')
        .then((res) => res.json())
        .then((data) => {
          document.getElementById('services').innerHTML = Object.entries(
            data.services
          )
            .map(([name, info]) => `<div>${name}: ${info.status}</div>`)
            .join('');
        });

      // Fetch metrics and render chart
      fetch('/health/metrics-summary')
        .then((res) => res.json())
        .then((data) => {
          // Render chart
        });
    </script>
  </body>
</html>
```

### 11. Environment Variables

Create complete `.env` for observability:

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Grafana
GRAFANA_ADMIN_PASSWORD=your_secure_password
GRAFANA_URL=https://grafana.railway.app

# Alerting (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
ALERT_EMAIL=alerts@yourdomain.com

# Metrics Retention
METRICS_RETENTION_DAYS=30
```

### 12. Railway Deployment Guide

Provide complete deployment instructions:

```bash
# 1. Add Prometheus service
railway add prometheus

# 2. Add Grafana service
railway add grafana

# 3. Link services
railway link api-gateway prometheus
railway link workers prometheus
railway link grafana prometheus

# 4. Set environment variables
railway env set GRAFANA_ADMIN_PASSWORD=your_password

# 5. Deploy
railway up
```

### 13. Monitoring Checklist

Create operational checklist:

```markdown
## Daily Monitoring Checklist

### Morning Check (9 AM)

- [ ] Check Grafana "System Health" dashboard
- [ ] Review error rate (should be < 0.5%)
- [ ] Check queue size (should be < 100)
- [ ] Review any alerts from overnight

### Weekly Review (Monday)

- [ ] Review 7-day error trends
- [ ] Identify worst-performing terminals
- [ ] Check database growth rate
- [ ] Review worker performance metrics

### Monthly Tasks

- [ ] Review and update alert thresholds
- [ ] Clean up old completed jobs
- [ ] Review capacity planning
- [ ] Update documentation
```

## Deliverables

Please provide:

1. ✅ Prometheus configuration files
2. ✅ Alerting rules (alerts.yml)
3. ✅ Grafana datasource configuration
4. ✅ 4 complete Grafana dashboard JSONs
5. ✅ Logging configuration (Winston)
6. ✅ Slack integration code
7. ✅ Health check aggregator
8. ✅ Railway deployment guide
9. ✅ Monitoring dashboard HTML (optional)
10. ✅ Environment variables template
11. ✅ Operational checklist
12. ✅ Troubleshooting guide
13. ✅ Complete README with setup instructions

## Success Criteria

The observability stack should:

- ✅ Collect metrics from API Gateway and Workers
- ✅ Provide 4 Grafana dashboards
- ✅ Send alerts for critical issues
- ✅ Aggregate logs from all services
- ✅ Have health check endpoint
- ✅ Deploy successfully to Railway
- ✅ Be production-ready and maintainable

## Notes

- Reference observability guide for complete implementation details
- Use architecture document for metric definitions
- Focus on Level 2 observability (Prometheus + Grafana)
- Keep setup simple but production-ready
- Provide both code and configuration

Please implement a complete observability stack for Railway deployment.
