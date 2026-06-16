# RevenuePilot AI backend image
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Copy the project and install it (+ dependencies).
COPY . .
RUN pip install --upgrade pip && pip install -e . \
    && chmod +x docker-entrypoint.sh

EXPOSE 8000

# Entrypoint runs migrations (+ optional seed) then starts the API.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
