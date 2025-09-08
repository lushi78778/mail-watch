// 前端页面（基于 shadcn/ui + TailwindCSS）
// 主要功能：
// 1) 访问门禁：URL 必须携带 ?key=...，并与 VITE_ACCESS_KEY 相同
// 2) 展示后端 /api/messages 返回的邮件列表
// 3) 支持设置展示条数（limit）与手动刷新
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Mail, RefreshCcw, Clock, User, ShieldAlert } from 'lucide-react';

// 简单的 JSON 拉取工具
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export default function App() {
  // 访问门禁：URL 中需携带 ?key=... 且与 VITE_ACCESS_KEY 一致
  const expectedKey = (import.meta.env.VITE_ACCESS_KEY || '').toString().trim();
  const urlKey = new URLSearchParams(window.location.search).get('key')?.trim() || '';
  const allowed = expectedKey.length > 0 && urlKey === expectedKey;

  // 页面状态
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(10);
  const [items, setItems] = useState([]);

  const regexText = useMemo(
    () => (config?.titleRegex ? String(config.titleRegex) : '（未配置，显示全部）'),
    [config]
  );

  // 读取后端基本配置（用于展示当前服务端默认正则）
  const loadConfig = async () => {
    try {
      const data = await fetchJSON('/api/config');
      setConfig(data);
    } catch (e) {
      console.warn('Failed to load config:', e.message);
    }
  };

  // 拉取邮件列表
  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON(`/api/messages?limit=${limit}`);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 初次加载：通过校验才发起网络请求
  useEffect(() => {
    if (!allowed) return;
    loadConfig();
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  // 未通过 key 校验时展示 403 提示
  if (!allowed) {
    return (
      <main className="min-h-svh grid place-items-center px-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive mb-2" />
          <h1 className="text-2xl font-semibold mb-2">403 Forbidden</h1>
          <p className="text-muted-foreground">
            {expectedKey
              ? '缺少或错误的访问 key（请在 URL 中使用 ?key=...）'
              : '系统未配置访问 key（VITE_ACCESS_KEY），请联系管理员'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-svh">
      {/* 顶部导航 */}
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

      {/* 页面主体 */}
      <main className="container-narrow py-4 md:py-6">
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 工具条：最新邮件 + 条数 + 刷新 */}
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
            const when = item.date ? new Date(item.date).toLocaleString() : '';
            return (
              <li key={item.uid}>
                <Card className="mw-card">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* <Badge className="bg-blue-600 text-white">UID {item.uid}</Badge> */}
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
            );
          })}
        </ul>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
  
        <div className="mt-2">
          MailWatch © {new Date().getFullYear()} | <span></span>
          <a
            href="https://github.com/lushi78778/mail-watch"
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-foreground"
          >
            项目地址（https://github.com/lushi78778/mail-watch）
          </a>
        </div>
        
      </footer>
    </div>
  );
}
