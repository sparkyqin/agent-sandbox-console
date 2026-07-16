// 目录 API：镜像/工具/模板 + 系统设置（BFF 控制面资产）。
import useSWR, { mutate } from 'swr'
import { api } from './client'
import { listKey } from './sandboxes'

export interface CatalogImage {
  uri: string; name: string; source: string; size: string; scan: string; refs: number; system: number
}
export interface CatalogTool {
  id: string; name: string; desc: string; category: string; version: string; install: string; enabled: number
}
export interface CatalogTemplate {
  id: string; name: string; imageUri: string; size: string; cpu: number; mem: number
  tools: string[]; tags: string[]; desc: string; updated: string
}
export interface Settings {
  def_idle_timeout: number
  def_max_lifetime: number
  def_egress: string
  def_docker_cli: boolean
  def_snap_ttl: number
  def_snap_fallback: boolean
  def_hibernate: boolean
  def_prewarm: boolean
}

export function useImages() {
  return useSWR<{ items: CatalogImage[] }>('/api/catalog/images', api.get)
}
export function useTools() {
  return useSWR<{ items: CatalogTool[] }>('/api/catalog/tools', api.get)
}
export function useTemplates() {
  return useSWR<{ items: CatalogTemplate[] }>('/api/catalog/templates', api.get)
}
export function useSettings() {
  return useSWR<Settings>('/api/control/settings', api.get)
}

export async function toggleTool(id: string, enabled: boolean) {
  await api.patch(`/api/catalog/tools/${id}`, { enabled })
  await mutate('/api/catalog/tools')
}

export async function createTemplate(body: { name: string; imageUri: string; size?: string; cpu?: number; mem?: number; tools?: string[]; tags?: string[]; desc?: string }) {
  const r = await api.post<{ id: string }>('/api/catalog/templates', body)
  await mutate('/api/catalog/templates')
  return r
}
export async function deleteTemplate(id: string) {
  await api.delete(`/api/catalog/templates/${id}`)
  await mutate('/api/catalog/templates')
}
/** 从模板一键创建沙箱，成功后刷新实例列表。 */
export async function createFromTemplate(id: string) {
  const r = await api.post<{ id: string }>(`/api/catalog/templates/${id}/create`, {})
  await mutate(listKey())
  return r
}

export async function patchSettings(body: Partial<Settings>) {
  await api.patch('/api/control/settings', body)
  await mutate('/api/control/settings')
}
