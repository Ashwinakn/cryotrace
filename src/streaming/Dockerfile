FROM python:3.11-slim

WORKDIR /app

# Install Java (required for PySpark)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre-headless \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set Java Home
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire streaming directory
COPY . .

# Set PYTHONPATH so 'import streaming' or 'from streaming' works if needed
# Actually, since we are in /app, and app is streaming, we might need to adjust imports or PYTHONPATH
ENV PYTHONPATH=/app

# Default command runs the spark jobs
CMD ["python", "spark/run_jobs.py"]
