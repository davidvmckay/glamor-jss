import http from 'http';
import fs from 'fs';
import React from 'react';
import express from 'express';
import path from 'path';
import ReactDOMServer from 'react-dom/server';
import { css } from '../../glamor-jss';
import CleanCss from 'clean-css';
import { App } from './client/App';

const __dirname = '.';

// You can minify the CSS sent from the server to save some bytes
const crossOriginDuringDev = process.env.NODE_ENV === 'production' ? 'crossorigin' : '';
const clean = new CleanCss();
const app = express()
    .disable('x-powered-by')
    .get('/', async (req, res) => {
        const rawHtml = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
        const reactSsrHtml = ReactDOMServer.renderToString(React.createElement(App));
        const ssrCss = clean.minify(css.renderToString()).styles;
        const html = rawHtml
            .replace('<!--dev-scripts-->', process.env.NODE_ENV === 'production' ? '' : `
    <script type="module" src="http://localhost:3000/@vite/client"></script>
    <script type="module">
        import RefreshRuntime from 'http://localhost:3000/@react-refresh'
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => {}
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
    </script>
            `)
            .replace('<!--ssr-css-->', `<style>${ssrCss}</style>`)
            .replace('<!--ssr-outlet-->', reactSsrHtml);
        res.status(200).send(html ?? rawHtml);
    });

if (process.env.NODE_ENV === 'production') {
    http
    .createServer(app)
    .listen(process.env.PORT || 3000, (e?: Error) => console.log(e ?? '🚀 started'));
}

  export const createViteNodeApp = app as any;