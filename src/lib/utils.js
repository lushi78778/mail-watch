import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 类名合并工具
// - 先处理条件类名与数组，再去重冲突样式
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
