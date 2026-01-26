// 轻量级的提示/告警 UI 组件集合（shadcn 风格简化版）
// 由 Alert、AlertTitle、AlertDescription 组成，支持 "destructive" 变体
import * as React from 'react'
// 工具：合并/去重 Tailwind 类名
import { cn } from '../../lib/utils'

// Alert: 外层容器
// - variant: 'default' | 'destructive'，控制文本与边框颜色
// - 其余属性（...props）透传到根 div（如 onClick、data-* 等）
function Alert({ className, variant = 'default', ...props }) {
  const base = 'relative w-full rounded-lg border p-4'
  const styles = variant === 'destructive'
    ? 'text-destructive border-destructive/40'
    : 'text-foreground border-border'
  return <div role="alert" className={cn(base, styles, className)} {...props} />
}

// AlertTitle: 标题行（加粗，紧凑行高）
function AlertTitle({ className, ...props }) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
}

// AlertDescription: 描述内容（较小字号，段落行高更舒适）
function AlertDescription({ className, ...props }) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
