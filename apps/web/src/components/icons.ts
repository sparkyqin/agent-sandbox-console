// 原型中 CustomImage.icon 存的是 lucide 组件引用；拆分后类型化为字符串 key，
// 此处集中映射，避免数据层依赖 React 组件。
import {
  Code,
  Database,
  Globe,
  Server,
  type LucideIcon,
} from 'lucide-react'

export const IMAGE_ICONS: Record<string, LucideIcon> = {
  Code,
  Database,
  Globe,
  Server,
}

export function imageIcon(key: string): LucideIcon {
  return IMAGE_ICONS[key] || Server
}
