FROM python:3.12-slim

WORKDIR /srv/uagp
COPY pyproject.toml ./
COPY src/ ./src/
RUN pip install --no-cache-dir .

ENV PYTHONDONTWRITEBYTECODE=1
EXPOSE 8000
CMD ["uvicorn", "uagp.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
