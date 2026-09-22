FROM python@sha256:1a63a53928ce53d2b0baf08092a703f4840ac5dfbd61fd48802dbf48e08c801e
RUN addgroup -g 1000 modsync && adduser -D -u 1000 -G modsync modsync
WORKDIR /app
COPY paperless_sync.py /app/paperless_sync.py
USER 1000:1000
ENTRYPOINT ["python3", "/app/paperless_sync.py"]
