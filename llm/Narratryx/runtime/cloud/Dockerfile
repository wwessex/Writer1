FROM python:3.10-slim
WORKDIR /app
COPY runtime/cloud/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY runtime/cloud/api.py /app/api.py
EXPOSE 8080
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
