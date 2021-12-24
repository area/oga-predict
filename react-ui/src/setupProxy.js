const { createProxyMiddleware } = require('http-proxy-middleware');
console.log("proxy")
module.exports = function(app) {
  app.use(
    '/login',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
    })
  );
  app.use(
    '/account',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
    })
  );
};
