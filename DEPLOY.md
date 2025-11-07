# Инструкция по деплою Poiskkino Bot

## Предварительные требования

1. Docker установлен и настроен
2. kubectl настроен и подключен к кластеру
3. Доступ к Docker Registry (mdwit)
4. Kubernetes секрет `poiskkino-bot` создан в namespace `poiskkino`

## Создание секрета для бота

Перед деплоем необходимо создать Kubernetes секрет с переменными окружения:

```bash
kubectl create namespace poiskkino

kubectl create secret generic poiskkino-bot \
  --from-literal=BOT_TOKEN="your-telegram-bot-token" \
  --from-literal=MONGO_URI="your-mongodb-uri" \
  --from-literal=REDIS_URL="your-redis-url" \
  --from-literal=CHAT_ID="your-chat-id" \
  --from-literal=ADMIN_CHAT_ID="your-admin-chat-id" \
  --namespace=poiskkino
```

Или можно создать секрет из файла `.env`:

```bash
kubectl create secret generic poiskkino-bot \
  --from-env-file=.env \
  --namespace=poiskkino
```

## Деплой

### Автоматический деплой (рекомендуется)

Используйте скрипт `deploy.sh`:

```bash
# Деплой с тегом latest
./deploy.sh

# Деплой с определенным тегом
./deploy.sh v1.0.0
```

### Ручной деплой

1. Соберите Docker образ:
```bash
docker build -t mdwit/poiskkino-bot:latest .
```

2. Запушьте образ в registry:
```bash
docker push mdwit/poiskkino-bot:latest
```

3. Примените Kubernetes манифесты:
```bash
kubectl apply -f infra/namespace.yaml
kubectl apply -f infra/deployment.yaml
kubectl apply -f infra/service.yaml
```

## Проверка статуса

Проверить статус deployment:
```bash
kubectl get deployment poiskkino-bot -n poiskkino
```

Проверить статус pods:
```bash
kubectl get pods -n poiskkino
```

Просмотр логов:
```bash
kubectl logs -f deployment/poiskkino-bot -n poiskkino
```

Описание pod (для отладки):
```bash
kubectl describe pod <pod-name> -n poiskkino
```

## Обновление конфигурации

Если нужно обновить секреты:

```bash
# Удалить старый секрет
kubectl delete secret poiskkino-bot -n poiskkino

# Создать новый
kubectl create secret generic poiskkino-bot \
  --from-env-file=.env \
  --namespace=poiskkino

# Перезапустить deployment
kubectl rollout restart deployment/poiskkino-bot -n poiskkino
```

## Откат к предыдущей версии

Если что-то пошло не так:

```bash
# Просмотр истории
kubectl rollout history deployment/poiskkino-bot -n poiskkino

# Откат к предыдущей версии
kubectl rollout undo deployment/poiskkino-bot -n poiskkino

# Откат к конкретной ревизии
kubectl rollout undo deployment/poiskkino-bot -n poiskkino --to-revision=2
```

## Удаление

Полное удаление бота из кластера:

```bash
kubectl delete -f infra/deployment.yaml
kubectl delete -f infra/service.yaml
kubectl delete secret poiskkino-bot -n poiskkino
```

## Структура файлов

- `infra/namespace.yaml` - определение namespace
- `infra/deployment.yaml` - конфигурация deployment
- `infra/service.yaml` - конфигурация service
- `deploy.sh` - скрипт автоматического деплоя
- `Dockerfile` - конфигурация Docker образа

## Изменения от kinopoisk к poiskkino

Основные изменения:
- Namespace: `kinopoisk` → `poiskkino`
- Deployment name: `kp-bot` → `poiskkino-bot`
- Service name: `kp-bot` → `poiskkino-bot`
- Docker image: `mdwit/kp-bot` → `mdwit/poiskkino-bot`
- Secret name: `kp-bot` → `poiskkino-bot`
- Bot name: `kinopoiskdev_bot` → `poiskkinodev_bot`
