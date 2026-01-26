import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// cn: 合并类名工具
// - 先用 clsx 处理条件类名/数组，再用 tailwind-merge 去重 Tailwind 冲突
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
