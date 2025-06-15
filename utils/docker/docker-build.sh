#!/bin/bash
[ "$1" = -x ] && shift && set -x
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd ${DIR}/../..

TAG=$1

if [[ -z "${TAG}" ]]; then
  TAG=${LIBRE_CHAT_DOCKER_TAG}
fi

if [[ -z "${TAG}" ]]; then
  TAG=latest
fi

LOCAL_DOCKER_IMG=librechat:${TAG}

set -e

# Build args for Paddle frontend environment variables
BUILD_ARGS=""
if [[ ! -z "${VITE_PADDLE_CLIENT_TOKEN}" ]]; then
  BUILD_ARGS="${BUILD_ARGS} --build-arg VITE_PADDLE_CLIENT_TOKEN=${VITE_PADDLE_CLIENT_TOKEN}"
fi
if [[ ! -z "${VITE_PADDLE_ENVIRONMENT}" ]]; then
  BUILD_ARGS="${BUILD_ARGS} --build-arg VITE_PADDLE_ENVIRONMENT=${VITE_PADDLE_ENVIRONMENT}"
fi

echo "Building Docker image with build args: ${BUILD_ARGS}"
docker build ${BUILD_ARGS} -t ${LOCAL_DOCKER_IMG} .
