const config = require('./config');
const { server } = require('./app');
const scheduler = require('./services/scheduler');

scheduler.start();

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${config.port}`);
  console.log(`[WS] WebSocket server ready on ws://0.0.0.0:${config.port}`);
});
