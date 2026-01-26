// 分割线组件：水平/垂直，纯样式分隔
import * as React from 'react'
import { cn } from '../../lib/utils'

// 分割线：方向参数控制水平或垂直，装饰模式仅作视觉用途
const Separator = React.forwardRef(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <div
    ref={ref}
    role={decorative ? 'none' : 'separator'}
    aria-orientation={orientation}
    className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
    {...props}
  />
))
Separator.displayName = 'Separator'

export { Separator }
