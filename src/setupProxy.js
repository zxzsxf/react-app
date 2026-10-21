const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use(createProxyMiddleware({
    pathFilter: '/api/lowcode/ai',
    target: 'http://127.0.0.1:1002',
    changeOrigin: true,
    proxyTimeout: 180000,
    timeout: 180000,
  }));
};
