# syntax=docker/dockerfile:1

FROM node:latest

LABEL org.opencontainers.image.title="Defender of the Faith"
LABEL org.opencontainers.image.description="Trusted Discord server administrative bot."
LABEL org.opencontainers.image.authors="self@matthewrease.net"

# Files

WORKDIR /app

## Node Packages

COPY package.json ./
RUN npm install --omit=dev --fund=false --update-notifier=false

## Main Files

COPY LICENSE ./
COPY deploy-commands.js ./
COPY index.js ./
COPY commands ./commands

# Runtime

CMD ["node", "index.js"]
