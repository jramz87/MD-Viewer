FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install compatible build tools
RUN pip install --upgrade pip setuptools==69.0.3 wheel

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with timeout
RUN pip install --no-cache-dir --timeout 1000 -r requirements.txt

# Copy all application files
COPY . .

# Expose the port
EXPOSE 5000

# Run the Flask application
CMD ["python", "app.py"]