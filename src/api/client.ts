/** 统一响应结构（后端 ApiResponse：{ code, message, data, traceId }） */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  traceId: string
}

export interface PageData<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export class ApiError extends Error {
  code: number
  traceId?: string

  constructor(code: number, message: string, traceId?: string) {
    super(message)
    this.code = code
    this.traceId = traceId
  }
}

const TOKEN_KEY = 'tongkey.token'
const USER_KEY = 'tongkey.user'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string, username: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, username)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
  user: () => localStorage.getItem(USER_KEY) ?? '',
}

let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const resp = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (resp.status === 401) {
    tokenStore.clear()
    onUnauthorized()
    throw new ApiError(20001, '未认证或登录已过期')
  }

  let json: ApiResponse<T>
  try {
    json = (await resp.json()) as ApiResponse<T>
  } catch {
    throw new ApiError(50000, `服务响应异常（HTTP ${resp.status}）`)
  }
  if (json.code !== 0) {
    throw new ApiError(json.code, json.message, json.traceId)
  }
  return json.data
}

export const get = <T>(path: string) => request<T>('GET', path)
export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)
export const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, body)
export const del = <T>(path: string) => request<T>('DELETE', path)

/** 时间格式化 */
export function fmtTime(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
