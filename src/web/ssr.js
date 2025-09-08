// SSR 集成：
// - 开发：接入 Vite 中间件，支持 HMR 与模板转换
// - 生产：读取 dist/client + dist/server 产物进行渲染
const fs = require('fs');
const path = require('path');

async function setupSSR(app) {
  const isProd = process.env.NODE_ENV === 'production';
  let viteServer;
  let prodTemplate = '';
  let prodRender;

  if (!isProd) {
    const vite = require('vite');
    viteServer = await vite.createServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(viteServer.middlewares);
  } else {
    const serve = require('express').static(path.resolve(process.cwd(), 'dist/client'), { index: false, maxAge: '1y' });
    app.use(serve);
    prodTemplate = fs.readFileSync(path.resolve(process.cwd(), 'dist/client/index.html'), 'utf-8');
    const { pathToFileURL } = require('url');
    const prodEntry = path.resolve(process.cwd(), 'dist/server/entry-server.mjs');
    const mod = await import(pathToFileURL(prodEntry).toString());
    prodRender = mod.render;
  }

  // 根据环境选择模板与渲染器，返回最终 HTML
  async function render(url, initialState) {
    let template;
    let render;
    if (!isProd) {
      template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
      template = await viteServer.transformIndexHtml(url, template);
      render = (await viteServer.ssrLoadModule('/src/entry-server.jsx')).render;
    } else {
      template = prodTemplate;
      render = prodRender;
    }
    const { html } = await render(url, initialState);
    const htmlWithState = template
      .replace('<!--ssr-outlet-->', html)
      .replace('__SSR_DATA__', JSON.stringify(initialState).replace(/</g, '\\u003c'));
    return htmlWithState;
  }

  return { render };
}

module.exports = { setupSSR };
