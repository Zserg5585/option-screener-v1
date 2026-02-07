# Options Screener API v2

API для получения данных по криптовалютным опционам с Binance.

## Доступ к API

API доступен по адресу **https://options.szhub.space** через Nginx (проксирует на порт 8080).

WebSocket: **wss://options.szhub.space**

## Сервер

- **IP:** 76.13.138.220
- **Порт:** 8080 (внутренний), 80 (Nginx)
- **Пользователь:** app
- **Путь:** /home/app/options-backend

## Подключение к серверу

```bash
ssh root@76.13.138.220
su - app
cd /home/app/options-backend
```

## Управление сервисом

```bash
pm2 status          # статус
pm2 logs options    # логи
pm2 restart options # перезапуск
pm2 stop options    # остановка
pm2 start index.js --name options  # запуск
```

## API Endpoints

### Health Check (публичный)

```
GET /health
```

### Список дат экспирации

```
GET /api/expiries
Header: x-api-key: my_secret_key_12345
```

### Статистика

```
GET /api/summary
Header: x-api-key: my_secret_key_12345
```

### Опционы с фильтрами

```
GET /api/options
Header: x-api-key: my_secret_key_12345
```

#### Доступные фильтры

| Параметр | Описание | Пример |
|----------|----------|--------|
| underlying | Базовый актив | BTC, ETH |
| type | Тип опциона | CALL, PUT |
| expiry | Дата экспирации | 260207 |
| minVolume | Мин. объём | 100 |
| maxVolume | Макс. объём | 1000 |
| minDelta | Мин. дельта | 0.4 |
| maxDelta | Макс. дельта | 0.6 |
| minGamma | Мин. гамма | 0.001 |
| maxGamma | Макс. гамма | 0.01 |
| minTheta | Мин. тета | -500 |
| maxTheta | Макс. тета | -100 |
| minVega | Мин. вега | 5 |
| maxVega | Макс. вега | 20 |
| minIV | Мин. implied volatility | 0.5 |
| maxIV | Макс. implied volatility | 2.0 |

### Top Movers (лидеры роста/падения)

```
GET /api/top-movers
Header: x-api-key: my_secret_key_12345
```

#### Параметры

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| limit | Кол-во записей в каждой категории | 10 |
| underlying | Фильтр по базовому активу (BTC, ETH) | все |

#### Пример ответа

```json
{
  "lastUpdate": "2026-02-07T10:00:00.000Z",
  "limit": 10,
  "gainers": [
    {
      "symbol": "BTC-260214-100000-C",
      "priceChange": "1200",
      "priceChangePercent": "45.5",
      "lastPrice": "3840",
      "volume": "25.10"
    }
  ],
  "losers": [
    {
      "symbol": "ETH-260207-3000-P",
      "priceChange": "-800",
      "priceChangePercent": "-60.2",
      "lastPrice": "530",
      "volume": "12.50"
    }
  ]
}
```

### Unusual Volume (аномальный объём)

```
GET /api/unusual-volume
Header: x-api-key: my_secret_key_12345
```

#### Параметры

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| underlying | Фильтр по базовому активу (BTC, ETH) | все |
| limit | Макс. кол-во записей | 20 |

#### Пример ответа

```json
{
  "lastUpdate": "2026-02-07T10:00:00.000Z",
  "avgVolume": 15.3,
  "threshold": 30.6,
  "count": 5,
  "data": [
    {
      "symbol": "BTC-260214-100000-C",
      "volume": "120.50",
      "lastPrice": "3840",
      "priceChange": "500",
      "ratio": 7.88
    }
  ]
}
```

## WebSocket

Real-time обновления данных по опционам через WebSocket.

### Подключение

```
wss://options.szhub.space
```

### Каналы

| Канал | Описание |
|-------|----------|
| `BTC` | Все опционы на BTC |
| `ETH` | Все опционы на ETH |
| `all` | Все опционы (BTC + ETH) |
| `top-movers` | Лидеры роста и падения |
| `unusual-volume` | Опционы с аномальным объёмом |

### Подписка на канал

Отправить JSON-сообщение:

```json
{"subscribe": "BTC"}
```

### Отписка от канала

```json
{"unsubscribe": "BTC"}
```

### Формат ответа сервера

```json
{
  "channel": "BTC",
  "data": { ... },
  "timestamp": "2026-02-07T10:00:00.000Z"
}
```

### Heartbeat

Сервер отправляет `ping` каждые **30 секунд** для поддержания соединения. Клиент должен отвечать `pong`.

### Пример подключения (JavaScript)

```javascript
const ws = new WebSocket("wss://options.szhub.space");

ws.onopen = () => {
  ws.send(JSON.stringify({ subscribe: "BTC" }));
  ws.send(JSON.stringify({ subscribe: "top-movers" }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(`[${msg.channel}]`, msg.data);
};
```

## Примеры запросов

```bash
# Health check
curl https://options.szhub.space/health

# Все опционы
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/options"

# BTC CALL опционы
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/options?underlying=BTC&type=CALL"

# Опционы на конкретную дату
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/options?underlying=BTC&expiry=260207"

# ATM опционы (delta 0.4-0.6)
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/options?underlying=BTC&minDelta=0.4&maxDelta=0.6"

# Опционы с высоким объёмом
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/options?minVolume=100"

# Top movers — BTC, топ 5
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/top-movers?underlying=BTC&limit=5"

# Unusual volume
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/unusual-volume?underlying=ETH&limit=10"

# Список экспираций
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/expiries"

# Статистика
curl -H "x-api-key: my_secret_key_12345" \
  "https://options.szhub.space/api/summary"
```

## Структура ответа /api/options

```json
{
  "lastUpdate": "2026-02-06T07:26:24.667Z",
  "count": 2,
  "filters": {"underlying": "BTC", "type": "CALL"},
  "data": [
    {
      "symbol": "BTC-260207-65000-C",
      "priceChange": "-955",
      "lastPrice": "1500",
      "volume": "15.89",
      "greeks": {
        "delta": "0.52129532",
        "gamma": "0.00010023",
        "theta": "-773.64478105",
        "vega": "13.73117089",
        "markIV": "1.16488146"
      }
    }
  ]
}
```

## Файлы проекта

```
/home/app/options-backend/
├── index.js       # Основной код API + WebSocket
├── package.json   # Зависимости
├── .env           # Конфигурация (PORT, API_KEY)
├── .gitignore     # Игнорируемые файлы
└── README.md      # Документация
```

## .env файл

```
PORT=8080
API_KEY=my_secret_key_12345
```

## Git репозиторий

https://github.com/Zserg5585/option-screener-v1

```bash
git add .
git commit -m "описание изменений"
git push
```

## TODO

- [x] ~~Добавить эндпоинт top gainers/losers~~
- [x] ~~Добавить эндпоинт unusual volume~~
- [x] ~~Добавить WebSocket для real-time данных~~
- [x] ~~Настроить Nginx для внешнего доступа~~
- [ ] Разбить код на модули (routes, services)
