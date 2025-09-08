// 分割线组件：水平/垂直，纯样式分隔
import * as React from 'react'
import { cn } from '../../lib/utils'

// Separator：orientation 控制方向，decorative=true 仅作视觉用途
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
