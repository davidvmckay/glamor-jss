import { App } from './App'
import React from 'react'
import ReactDOM from 'react-dom'

const ssr = document.getElementById('ssr')!;
if (ssr) {
  ReactDOM.hydrate(
    React.createElement(App),
    document.getElementById('root'),
    () => ssr.parentNode?.removeChild(ssr),
  );
} else {
  
  ReactDOM.render(
    React.createElement(App),
    document.getElementById('root'),
  );
}
