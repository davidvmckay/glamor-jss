import http from 'http';
import fs from 'fs';
import React from 'react';
import express from 'express';
import path from 'path';
import ReactDOMServer from 'react-dom/server';
import { css } from '../../glamor-jss';
import CleanCss from 'clean-css';
import { App } from './client/App';
import { createServer as createViteServer } from 'vite';

const __dirname = '.';

// You can minify the CSS sent from the server to save some bytes
const crossOriginDuringDev = process.env.NODE_ENV === 'production' ? 'crossorigin' : '';
const clean = new CleanCss();
const app = express()
    .disable('x-powered-by')
    .use('/style.css', express.static(path.join(__dirname, 'style.css')))
    .use('/plyfills', express.static(path.join(__dirname, 'polyfills.ts')))
    .use('/client', express.static(path.join(__dirname, 'client/index.ts')))
    .get('/', async (req, res) => {
        const rawHtml = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
        const reactSsrHtml = ReactDOMServer.renderToString(React.createElement(App));
        const ssrCss = clean.minify(css.renderToString()).styles;
        const html = rawHtml.replace('/*ssr-css*/', ssrCss).replace('<!--ssr-outlet-->', reactSsrHtml);
        res.status(200).send(html ?? rawHtml);
    });

// await createViteServer({server: {middlewareMode: 'ssr'}});

if (process.env.NODE_ENV === 'production') {
    http
    .createServer(app)
    .listen(process.env.PORT || 3000, (e?: Error) => console.log(e ?? '🚀 started'));
}

  export const createViteNodeApp = app as any;