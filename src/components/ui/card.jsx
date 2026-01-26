// 卡片容器组件：用于包裹内容的简易卡片与内容区
import * as React from 'react'
import { cn } from '../../lib/utils'

// 外层容器：边框 + 圆角 + 阴影
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
))
Card.displayName = 'Card'

// 内容区：默认有内边距
const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

export { Card, CardContent }
