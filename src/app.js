const express = require('express');
const http = require('http');
const healthRoutes = require('./routes/health');
const optionsRoutes = require('./routes/options');
const signalsRoutes = require('./routes/signals');
const { setupWebSocket } = require('./websocket');
const scheduler = require('./services/scheduler');

const app = express();
const server = http.createServer(app);

app.use(healthRoutes);
app.use(optionsRoutes);
app.use(signalsRoutes);

const { broadcastUpdates } = setupWebSocket(server);
scheduler.setBroadcast(broadcastUpdates);

module.exports = { app, server };
