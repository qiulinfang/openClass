const http = require('http');
const https = require('https');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultEnhanceMiddleware = config.server.enhanceMiddleware;

/**
 * Keep browser requests same-origin during Expo Web development.
 * Production Nginx already proxies these paths, matching imates-web.
 */
config.server.enhanceMiddleware = (metroMiddleware, metroServer) => {
  const enhancedMetroMiddleware = defaultEnhanceMiddleware
    ? defaultEnhanceMiddleware(metroMiddleware, metroServer)
    : metroMiddleware;

  return (request, response, next) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    const isKnowledgeRequest = pathname === '/knowledge';
    const isGatewayRequest =
      pathname.startsWith('/yb-release/') ||
      pathname.startsWith('/yb-test/') ||
      pathname.startsWith('/xb-release/') ||
      pathname.startsWith('/xb-test/');
    if (!isKnowledgeRequest && !isGatewayRequest) {
      return enhancedMetroMiddleware(request, response, next);
    }

    const targetPort = isKnowledgeRequest ? 8090 : 443;
    const headers = {
      ...request.headers,
      host: isKnowledgeRequest
        ? 'www.imates.com.cn:8090'
        : 'www.imates.com.cn',
    };
    delete headers.origin;
    delete headers.referer;

    const transport = isKnowledgeRequest ? http : https;
    const proxyRequest = transport.request(
      {
        hostname: 'www.imates.com.cn',
        port: targetPort,
        path: request.url,
        method: request.method,
        headers,
      },
      (proxyResponse) => {
        response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
        proxyResponse.pipe(response);
      }
    );

    proxyRequest.on('error', (error) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(
        JSON.stringify({
          success: false,
          message: `本地开发代理失败：${error.message}`,
        })
      );
    });

    request.pipe(proxyRequest);
  };
};

module.exports = config;
