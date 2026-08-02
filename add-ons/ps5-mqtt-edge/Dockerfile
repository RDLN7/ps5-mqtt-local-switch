ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM $BUILD_FROM

ENV LANG=C.UTF-8
ARG BUILD_VERSION

RUN apk add --no-cache --virtual .build-dependencies \
    make gcc g++ linux-headers udev git python3 py3-protobuf protoc cmake \
    pkgconf perl openssl-dev json-c-dev miniupnpc-dev && \
    apk add --no-cache nodejs-current npm

RUN npm i -g playactor
RUN mkdir -p ~/.config/playactor

RUN mkdir -p /app/ps5-mqtt

COPY ps5-mqtt/server/.packaged/ ./app/ps5-mqtt/
COPY run.sh ./app/ps5-mqtt/run.sh

RUN cmake -S /app/ps5-mqtt/native/local-remote-play \
      -B /tmp/local-rp-build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build /tmp/local-rp-build --target ps5-mqtt-local-rp -j2 && \
    install -m 0755 /tmp/local-rp-build/ps5-mqtt-local-rp \
      /usr/local/bin/ps5-mqtt-local-rp && \
    rm -rf /tmp/local-rp-build /app/ps5-mqtt/native

RUN apk add --no-cache json-c miniupnpc

RUN cd /app/ps5-mqtt/server && \
    npm install --omit=dev --omit=optional

# set permissions for the Home Assistant add-on startup script
RUN chmod a+x /app/ps5-mqtt/run.sh

EXPOSE 8645

ENTRYPOINT ["/app/ps5-mqtt/run.sh"]
