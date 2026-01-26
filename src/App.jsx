// 应用主页面（服务端首屏 + 客户端水合）
// 职责：
// - 展示最新邮件列表（服务端渲染）
// - 支持整页刷新重新加载
// - 服务端会注入初始状态，首屏无需再拉取数据
import React, { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Separator } from './components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { Mail, RefreshCcw, Clock, User, ShieldAlert } from 'lucide-react'
import './index.css'

export function App({ initialState = {} }) {
  const config = initialState.config || null
  const error = initialState.error || null
  const items = initialState.items || []
  const allowed = initialState.allowed !== false
  const hasKeyConfigured = !!initialState.hasKeyConfigured
  const [copiedUid, setCopiedUid] = useState(null)
  // 会话提示（仅信息性提示，唯一会话用于访问控制）
  const [consented, setConsented] = useState(true)

  // 客户端检查本地是否已同意会话提示
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

  const copyCode = async (uid, code) => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopiedUid(uid)
      setTimeout(() => setCopiedUid((prev) => (prev === uid ? null : prev)), 2000)
    } catch {
      setCopiedUid(null)
    }
  }

  // 通过服务端渲染重新加载
  const reloadPage = () => {
    window.location.reload()
  }

  // 未登录（缺少会话标记）时的保护页
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
            <p className="text-sm text-muted-foreground">验证码由 AI 自动提取</p>
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
            <Button onClick={reloadPage} className="gap-1">
              <RefreshCcw className="h-4 w-4" /> 刷新
            </Button>
          </div>
        </div>

        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-12">暂无匹配邮件</div>
        )}

        <ul className="space-y-3">
          {items.map((item) => {
            const when = item.date ? new Date(item.date).toLocaleString() : ''
            const parsed = (() => {
              try {
                return JSON.parse(item.captcha)
              } catch {
                return null
              }
            })()
            const code = parsed && typeof parsed === 'object' ? parsed.code : item.captcha
            const time = parsed && typeof parsed === 'object' ? parsed.time : null
            return (
              <li key={item.uid}>
                <Card
                  className={`mw-card ${item.captcha ? 'cursor-pointer hover:bg-accent/40' : ''}`}
                  onClick={() => copyCode(item.uid, code)}
                >
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
                      {item.captcha && (
                        <div className="inline-flex items-center gap-1">
                          <span className="text-foreground">验证码</span>
                          <span className="font-medium text-foreground underline underline-offset-2">
                            {code}
                          </span>
                          {time && <span className="text-muted-foreground">({time})</span>}
                        </div>
                      )}
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

      {/* 会话提示（仅必要会话：用于访问控制）*/}
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

      {copiedUid && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center pointer-events-none">
          <div className="rounded-md bg-foreground text-background px-4 py-2 text-sm shadow-lg">
            验证码已复制
          </div>
        </div>
      )}
    </div>
  )
}
