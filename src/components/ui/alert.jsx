// 轻量级提示组件集合（简化版）
// 由提示容器、标题、描述组成，支持破坏性样式
import * as React from 'react'
// 工具：合并并去重类名
import { cn } from '../../lib/utils'

// 提示容器：外层包裹
// - 变体控制文本与边框颜色
// - 其余属性透传到根容器
function Alert({ className, variant = 'default', ...props }) {
  const base = 'relative w-full rounded-lg border p-4'
  const styles = variant === 'destructive'
    ? 'text-destructive border-destructive/40'
    : 'text-foreground border-border'
  return <div role="alert" className={cn(base, styles, className)} {...props} />
}

// 标题行：加粗，紧凑行高
function AlertTitle({ className, ...props }) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
}

// 描述内容：较小字号，段落行高更舒适
function AlertDescription({ className, ...props }) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
