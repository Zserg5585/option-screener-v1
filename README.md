# Options Screener API v2

API для получения данных по криптовалютным опционам с Binance.

## Сервер

- **IP:** 76.13.138.220
- **Порт:** 8080
- **Пользователь:** app
- **Путь:** /home/app/options-backend

## Подключение к серверу

```bash
ssh root@76.13.138.220
su - app
cd /home/app/options-backend
 

Управление сервисом

 
pm2 status          # статус
pm2 logs options    # логи
pm2 restart options # перезапуск
pm2 stop options    # остановка
pm2 start index.js --name options  # запуск
 

API Endpoints

Health Check (публичный)

 
GET /health
 

Список дат экспирации

 
GET /api/expiries
Header: x-api-key: my_secret_key_12345
 

Статистика

 
GET /api/summary
Header: x-api-key: my_secret_key_12345
 

Опционы с фильтрами

 
GET /api/options
Header: x-api-key: my_secret_key_12345
 

Доступные фильтры

 
 
 
 
 
 
 
 
 
 
 
 
 

Примеры запросов

 
# Health check
curl http://localhost:8080/health

# Все опционы
curl -H "x-api-key: my_secret_key_12345" \
  "http://localhost:8080/api/options"

# BTC CALL опционы
curl -H "x-api-key: my_secret_key_12345" \
  "http://localhost:8080/api/options?underlying=BTC&type=CALL"

# Опционы на конкретную дату
curl -H "x-api-key: my_secret_key_12345" \
  "http://localhost:8080/api/options?underlying=BTC&expiry=260207"

# ATM опционы (delta 0.4-0.6)
curl -H "x-api-key: my_secret_key_12345" \
  "http://localhost:8080/api/options?underlying=BTC&minDelta=0.4&maxDelta=0.6"

# Опционы с высоким объёмом
curl -H "x-api-key: my_secret_key_12345" \
  "http://localhost:8080/api/options?minVolume=100"

# Список экспираций
curl -H "x-api-key: my_secret_key_12345" \
  "http://localhost:8080/api/expiries"

# Статистика
curl -H "x-api-key: my_secret_key_12345" \
  "http://localhost:8080/api/summary"
 

Структура ответа /api/options

 
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
 

Файлы проекта

 
/home/app/options-backend/
├── index.js       # Основной код API
├── package.json   # Зависимости
├── .env           # Конфигурация (PORT, API_KEY)
├── .gitignore     # Игнорируемые файлы
└── README.md      # Документация
 

.env файл

 
PORT=8080
API_KEY=my_secret_key_12345
 

Git репозиторий

https://github.com/Zserg5585/option-screener-v1

 
git add .
git commit -m "описание изменений"
git push
 

TODO

Настроить Nginx для внешнего доступа
Разбить код на модули (routes, services)
Добавить эндпоинт top gainers/losers
Добавить эндпоинт unusual volume
Добавить WebSocket для real-time данных
