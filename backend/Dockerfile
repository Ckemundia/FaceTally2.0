# Use Python 3.11 slim base image
FROM python:3.11-slim


# Install Java runtime (required by Hedera SDK via jnius)
RUN apt-get update && \
    apt-get install -y openjdk-21-jdk-headless && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all backend files
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the FastAPI port
EXPOSE 8000

# Run FastAPI app with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
