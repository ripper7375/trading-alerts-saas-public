# Multi-stage build for optimal layer caching and security
FROM python:3.11-slim as builder

# Set build arguments
ARG BUILD_DATE
ARG VERSION
ARG REVISION

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libdrm2 \
    libxss1 \
    libgconf-2-4 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim as production

# Set labels for metadata
LABEL maintainer="Trading Alerts SaaS" \
      version="1.0.0" \
      description="Flask MT5 Service for Trading Alerts" \
      build-date="${BUILD_DATE}" \
      git-revision="${REVISION}"

# Install runtime system dependencies for MetaTrader5
RUN apt-get update && apt-get install -y \
    # X11 libraries for MT5
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgtk-3-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libdrm2 \
    libxss1 \
    # Audio libraries
    libasound2 \
    # Additional utilities
    curl \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r mt5user && \
    useradd -r -g mt5user -m -s /bin/bash mt5user && \
    usermod -aG audio mt5user

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set working directory
WORKDIR /app

# Copy application code
COPY --chown=mt5user:mt5user . .

# Create necessary directories
RUN mkdir -p /app/logs /app/tmp && \
    chown -R mt5user:mt5user /app

# Switch to non-root user
USER mt5user

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=run.py \
    FLASK_ENV=production \
    GUNICORN_WORKERS=4 \
    GUNICORN_WORKER_CLASS=gevent \
    GUNICORN_WORKER_CONNECTIONS=1000 \
    GUNICORN_TIMEOUT=120 \
    GUNICORN_KEEPALIVE=5 \
    GUNICORN_PRELOAD_APP=true \
    GUNICORN_ACCESSLOG=- \
    GUNICORN_ERRORLOG=- \
    GUNICORN_LOGLEVEL=info \
    MT5_LOGIN_TIMEOUT=30 \
    MT5_RECONNECT_INTERVAL=10 \
    MT5_MAX_RETRIES=3 \
    HEALTH_CHECK_PORT=5001

# Expose port
EXPOSE 5001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/health || exit 1

# Start application with gunicorn
CMD ["sh", "-c", "gunicorn \
    --bind 0.0.0.0:5001 \
    --workers $GUNICORN_WORKERS \
    --worker-class $GUNICORN_WORKER_CLASS \
    --worker-connections $GUNICORN_WORKER_CONNECTIONS \
    --timeout $GUNICORN_TIMEOUT \
    --keepalive $GUNICORN_KEEPALIVE \
    --preload \
    --access-logfile $GUNICORN_ACCESSLOG \
    --error-logfile $GUNICORN_ERRORLOG \
    --log-level $GUNICORN_LOGLEVEL \
    --capture-output \
    --enable-stdio-inheritance \
    run:app"]
