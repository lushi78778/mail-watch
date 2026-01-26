// 客户端入口：将服务端渲染页面进行水合并接管交互
import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { App } from './App.jsx'

// 初始状态来自页面模板注入（服务端替换）
const initial = window.__INITIAL_STATE__ || {}
hydrateRoot(document.getElementById('root'), <App initialState={initial} />)
