// 应用主页面（SSR 首屏 + 客户端水合）
// 职责：
// - 展示最新邮件列表（与后端 /api/messages 对接）
// - 支持设置条数并手动刷新
// - SSR 会注入 initialState，首屏无需再拉取数据
import React, { useEffect, useMemo, useState } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent } from './components/ui/card'
import { Separator } from './components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { Mail, RefreshCcw, Clock, User, ShieldAlert } from 'lucide-react'
import './index.css'

// 简单的 JSON 请求工具（抛错即显示到 UI）
async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export function App({ initialState = {} }) {
  const [config, setConfig] = useState(initialState.config || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialState.error || null)
  const [limit, setLimit] = useState(initialState.limit || 10)
  const [items, setItems] = useState(initialState.items || [])
  const allowed = initialState.allowed !== false
  const hasKeyConfigured = !!initialState.hasKeyConfigured
  // Cookie 同意（仅信息性提示，唯一 Cookie 为必要会话 Cookie）
  const [consented, setConsented] = useState(true)

  const regexText = useMemo(
    () => (config?.titleRegex ? String(config.titleRegex) : '（未配置，显示全部）'),
    [config]
  )

  // 客户端挂载后刷新配置（SSR 已注入也不影响）
  useEffect(() => {
    fetchJSON('/api/config').then(setConfig).catch(() => {})
  }, [])

  // 客户端检查本地是否已同意 Cookie 提示
  useEffect(() => {
    try {
      setConsented(localStorage.getItem('mw_cookie_consent_v1') === 'true')
    } catch {}
  }, [])

  const acceptConsent = () => {
    try {
      localStorage.setItem('mw_cookie_consent_v1', 'true')
    } catch {}
    setConsented(true)
  }

  // 手动刷新最新邮件列表
  const loadMessages = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJSON(`/api/messages?limit=${limit}`)
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // 未登录（缺少会话 Cookie）时的保护页
  if (!allowed && hasKeyConfigured) {
    return (
      <main className="min-h-svh grid place-items-center px-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive mb-2" />
          <h1 className="text-2xl font-semibold mb-2">403 Forbidden</h1>
          <p className="text-muted-foreground">缺少或错误的访问 key（请在 URL 中使用 ?key=...）</p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
        <div className="container-narrow py-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" /> MailWatch
            </h1>
            <p className="text-sm text-muted-foreground">标题筛选（正则）：{regexText}</p>
          </div>
        </div>
      </header>

      <main className="container-narrow py-4 md:py-6">
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg md:text-xl font-medium">最新邮件</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">条数</span>
            <Input
              type="number"
              min={1}
              max={500}
              className="w-24"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            />
            <Button onClick={loadMessages} className="gap-1">
              <RefreshCcw className="h-4 w-4" /> 刷新
            </Button>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground py-6">加载中...</p>}

        {!loading && items.length === 0 && (
          <div className="text-center text-muted-foreground py-12">暂无匹配邮件</div>
        )}

        <ul className="space-y-3">
          {items.map((item) => {
            const when = item.date ? new Date(item.date).toLocaleString() : ''
            return (
              <li key={item.uid}>
                <Card className="mw-card">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium truncate flex-1" title={item.subject}>
                        {item.subject || '(无标题)'}
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="inline-flex items-center gap-1 min-w-0">
                        <User className="h-4 w-4" />
                        <span className="truncate" title={item.from}>{item.from}</span>
                      </div>
                      <div className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{when}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        MailWatch © {new Date().getFullYear()} |{' '}
        <a
          href="https://github.com/lushi78778/mail-watch"
          target="_blank"
          rel="noreferrer noopener"
          className="underline hover:text-foreground"
        >
          项目地址（GitHub）
        </a>
      </footer>

      {/* Cookie 同意提示（仅必要 Cookie：用于访问控制的会话）*/}
      {!consented && (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <div className="mx-auto max-w-3xl m-3 rounded-md border bg-background/95 backdrop-blur p-3 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                我们仅使用必需的 Cookie（会话）用于访问控制与安全，不用于追踪或广告。继续使用即表示您同意使用此必要 Cookie。
              </p>
              <Button onClick={acceptConsent} className="shrink-0">我已知晓</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
