#!/bin/bash

# Скрипт для деплоя Poiskkino Bot

set -e

IMAGE_NAME="mdwit/poiskkino-bot"
TAG="${1:-latest}"

echo "🔨 Building Docker image: ${IMAGE_NAME}:${TAG}"
docker build -t ${IMAGE_NAME}:${TAG} .

echo "📤 Pushing Docker image to registry..."
docker push ${IMAGE_NAME}:${TAG}

echo "🚀 Applying Kubernetes manifests..."

# Создаем namespace если его нет
kubectl apply -f infra/namespace.yaml

# Деплоим приложение
kubectl apply -f infra/deployment.yaml
kubectl apply -f infra/service.yaml

echo "✅ Deployment completed!"
echo ""
echo "📊 Check deployment status:"
echo "   kubectl get pods -n poiskkino"
echo "   kubectl logs -f deployment/poiskkino-bot -n poiskkino"
