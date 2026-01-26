// 客户端入口：将 SSR 生成的 HTML 进行水合，接管交互
import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { App } from './App.jsx'

// initial state 来自 index.html 注入（服务端替换）
const initial = window.__INITIAL_STATE__ || {}
hydrateRoot(document.getElementById('root'), <App initialState={initial} />)
