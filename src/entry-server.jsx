// 服务端入口：将应用渲染为字符串（服务端渲染）
import React from 'react'
import { renderToString } from 'react-dom/server'
import { App } from './App.jsx'

// 仅负责返回页面片段，由外层模板注入
export function render(url, initialState) {
  const html = renderToString(<App initialState={initialState} />)
  return { html }
}
