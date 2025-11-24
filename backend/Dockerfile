# Dockerfile for TOS Helper Backend
# Optimized for Render free tier deployment

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render uses PORT environment variable, defaults to 10000)
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:10000/api/health', timeout=5)"

# Run with gunicorn for production
# Render will set PORT environment variable
CMD gunicorn --bind 0.0.0.0:${PORT:-10000} --workers 2 --threads 2 --timeout 120 --access-logfile - --error-logfile - app:app
