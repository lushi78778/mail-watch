import React, { useEffect, useRef, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Separator } from './components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { Mail, RefreshCcw, Clock, User, ShieldAlert } from 'lucide-react'
import './index.css'

function decodeQuotedPrintableToUtf8(input) {
  const raw = String(input || '').replace(/=\r?\n/g, '')
  const bytes = []
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(raw.slice(i + 1, i + 3))) {
      bytes.push(parseInt(raw.slice(i + 1, i + 3), 16))
      i += 2
      continue
    }
    bytes.push(raw.charCodeAt(i))
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
}

function parseMessageBody(source) {
  const full = String(source || '')
  const splitIndex = full.search(/\r?\n\r?\n/)
  if (splitIndex < 0) return { renderedHtml: null, plainText: full }

  const headers = full.slice(0, splitIndex)
  const bodyRaw = full.slice(splitIndex).replace(/^\r?\n\r?\n/, '')
  const isHtml = /content-type:\s*text\/html/i.test(headers)
  const isQuotedPrintable = /content-transfer-encoding:\s*quoted-printable/i.test(headers)
  const decoded = isQuotedPrintable ? decodeQuotedPrintableToUtf8(bodyRaw) : bodyRaw
  return {
    renderedHtml: isHtml ? decoded : null,
    plainText: decoded,
  }
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function htmlToPlainText(html) {
  const bodyOnly = (() => {
    const s = String(html || '')
    const match = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    return match ? match[1] : s
  })()

  const raw = bodyOnly
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // 链接文本化：保留可读文本，去掉可点击属性
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  const normalized = decodeHtmlEntities(raw)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

  return normalized.trim()
}

export function App({ initialState = {} }) {
  const error = initialState.error || null
  const items = initialState.items || []
  const allowed = initialState.allowed !== false
  const hasKeyConfigured = !!initialState.hasKeyConfigured
  const filters = initialState?.config?.filter || {}

  const [openUid, setOpenUid] = useState(null)
  const [openLoading, setOpenLoading] = useState(false)
  const [openError, setOpenError] = useState(null)
  const [openMessage, setOpenMessage] = useState(null)
  const sourceRef = useRef(null)

  const [consented, setConsented] = useState(true)
  useEffect(() => {
    try {
      setConsented(localStorage.getItem('mw_cookie_consent_v1') === 'true')
    } catch {}
  }, [])

  useEffect(() => {
    return () => {
      if (sourceRef.current) sourceRef.current.close()
    }
  }, [])

  const acceptConsent = () => {
    try {
      localStorage.setItem('mw_cookie_consent_v1', 'true')
    } catch {}
    setConsented(true)
  }

  const closeMessage = () => {
    if (sourceRef.current) {
      sourceRef.current.close()
      sourceRef.current = null
    }
    setOpenUid(null)
    setOpenMessage(null)
    setOpenError(null)
    setOpenLoading(false)
  }

  const openDetail = (uid) => {
    if (!uid) return
    if (openUid === uid) {
      closeMessage()
      return
    }
    if (sourceRef.current) sourceRef.current.close()

    setOpenUid(uid)
    setOpenLoading(true)
    setOpenError(null)
    setOpenMessage(null)

    const es = new EventSource(`/stream/message?uid=${encodeURIComponent(String(uid))}`)
    sourceRef.current = es

    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data || '{}')
        setOpenMessage(data)
        setOpenLoading(false)
        es.close()
        sourceRef.current = null
      } catch {
        setOpenError('正文解析失败')
        setOpenLoading(false)
        es.close()
        sourceRef.current = null
      }
    })

    es.addEventListener('app_error', (event) => {
      let msg = '正文加载失败'
      try {
        const data = JSON.parse(event.data || '{}')
        if (data?.error) msg = data.error
      } catch {}
      setOpenError(msg)
      setOpenLoading(false)
      es.close()
      sourceRef.current = null
    })

    es.onerror = () => {
      setOpenError('正文加载失败')
      setOpenLoading(false)
      es.close()
      sourceRef.current = null
    }
  }

  const reloadPage = () => {
    window.location.reload()
  }

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
    <div className="min-h-svh pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
        <div className="container-narrow py-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" /> MailWatch
            </h1>
            <p className="text-sm text-muted-foreground">SSR 邮件查看（SSE 按需拉取正文）</p>
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

        <div className="mb-3 text-sm text-muted-foreground">
          筛选：发件人后缀 {filters?.fromDomainSuffixWhitelist?.join(', ') || 'openai.com'} 且主题包含 {filters?.subjectWhitelist?.join(', ') || '-'}
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg md:text-xl font-medium">最新邮件</h2>
          <div className="flex items-center gap-2">
            <Button onClick={reloadPage} className="gap-1">
              <RefreshCcw className="h-4 w-4" /> 刷新
            </Button>
          </div>
        </div>

        {items.length === 0 && <div className="text-center text-muted-foreground py-12">暂无匹配邮件</div>}

        <ul className="space-y-3">
          {items.map((item) => {
            const when = item.date ? new Date(item.date).toLocaleString() : ''
            const isCurrent = openUid === item.uid
            const parsedBody = isCurrent && openMessage ? parseMessageBody(openMessage.source) : null
            return (
              <li key={item.uid}>
                <Card className="mw-card">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium truncate flex-1" title={item.subject}>
                        {item.subject || '(无标题)'}
                      </div>
                      <Button variant="outline" onClick={() => openDetail(item.uid)}>
                        {isCurrent ? '收起正文' : '查看正文'}
                      </Button>
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

                {isCurrent && (
                  <div className="mt-2 rounded-xl border bg-background shadow-sm">
                    <div className="px-4 pt-2">
                      <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
                    </div>
                    <div className="px-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-muted-foreground">邮件正文</div>
                          <div className="font-medium truncate" title={openMessage?.subject || ''}>
                            {openMessage?.subject || `UID ${openUid}`}
                          </div>
                        </div>
                        <Button variant="outline" onClick={closeMessage}>关闭</Button>
                      </div>
                      <Separator className="my-3" />

                      {openLoading && <div className="text-muted-foreground">加载中…</div>}
                      {openError && (
                        <Alert variant="destructive">
                          <AlertTitle>加载失败</AlertTitle>
                          <AlertDescription>{openError}</AlertDescription>
                        </Alert>
                      )}
                      {!openLoading && !openError && openMessage && (
                        <div className="space-y-3">
                          <div className="rounded-md border bg-muted/30 p-3 overflow-auto max-h-[42svh]">
                            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                              {parsedBody?.renderedHtml
                                ? htmlToPlainText(parsedBody.renderedHtml)
                                : (parsedBody?.plainText || openMessage.source)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        MailWatch © {new Date().getFullYear()}
      </footer>

      {!consented && (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <div className="mx-auto max-w-3xl m-3 rounded-md border bg-background/95 backdrop-blur p-3 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                我们仅使用必需的 Cookie（会话）用于访问控制与安全，不用于追踪或广告。
              </p>
              <Button onClick={acceptConsent} className="shrink-0">我已知晓</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
