import http from 'http';
import React from 'react';
import express from 'express';
import path from 'path';
import ReactDOMServer from 'react-dom/server';
import { css } from '../src';
import CleanCss from 'clean-css';
import { App } from './client/App';

// You can minify the CSS sent from the server to save some bytes
const crossOriginDuringDev = process.env.NODE_ENV === 'production' ? 'crossorigin' : '';
const clean = new CleanCss();
http
  .createServer(
    express()
      .disable('x-powered-by')
      .use('/client', express.static(path.join(__dirname, 'client')))
      .get('/', (req, res) => {
        
        return res.status(200).send(`
<!doctype html>
<html>
<head>
  <title>glamor-jss</title>
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style id="ssr">${clean.minify(css.manager.renderToString()).styles}</style>
  <link href="https://fonts.googleapis.com/css?family=Alegreya" rel="stylesheet">
</head>
<body>
  <div id="root">${ReactDOMServer.renderToString(React.createElement(App))}</div>
  <script type="module" src="client/script.js" defer ${crossOriginDuringDev}></script>
</body>
</html>`);
  }))
  .listen(process.env.PORT || 3000, (e?: Error) => console.log(e ?? '🚀 started'));
