// 服务端入口：将 App 渲染为字符串（SSR）
import React from 'react'
import { renderToString } from 'react-dom/server'
import { App } from './App.jsx'

// 仅负责返回 HTML 片段，由外层模板注入到页面
export function render(url, initialState) {
  const html = renderToString(<App initialState={initialState} />)
  return { html }
}
