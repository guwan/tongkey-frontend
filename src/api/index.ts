import { get, post, put, del, type PageData } from './client'
import type {
  ApiAccessLog, AuditLog, ClientView, DashboardData, DataSourceView, PermissionView,
  PushLog, PushTargetView, RoleDetail, RoleView, SqlPreviewResult, SyncLog, SyncMapping,
  UserDetail, UserView,
} from './types'

const q = (params: Record<string, unknown>) => {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export const authApi = {
  login: (username: string, password: string) =>
    post<{ token: string; username: string }>('/console/auth/login', { username, password }),
  logout: () => post<void>('/console/auth/logout'),
  me: () => get<{ username: string; channel: string }>('/console/auth/me'),
}

export const dashboardApi = {
  get: () => get<DashboardData>('/console/dashboard'),
}

export const userApi = {
  page: (page: number, size: number, keyword?: string, sourceType?: string, status?: string) =>
    get<PageData<UserView>>(`/console/users${q({ page, size, keyword, sourceType, status })}`),
  detail: (id: string) => get<UserDetail>(`/console/users/${id}`),
  create: (body: { username: string; displayName?: string; status?: string; extraAttrs?: string }) =>
    post<UserView>('/console/users', body),
  update: (id: string, body: { displayName?: string; status?: string; extraAttrs?: string }) =>
    put<UserView>(`/console/users/${id}`, body),
  remove: (id: string) => del<void>(`/console/users/${id}`),
  bindRole: (userId: string, roleId: string) => post<void>(`/console/users/${userId}/roles`, { roleId }),
  unbindRole: (userId: string, roleId: string) => del<void>(`/console/users/${userId}/roles/${roleId}`),
}

export const roleApi = {
  page: (page: number, size: number, keyword?: string, sourceType?: string) =>
    get<PageData<RoleView>>(`/console/roles${q({ page, size, keyword, sourceType })}`),
  detail: (id: string) => get<RoleDetail>(`/console/roles/${id}`),
  create: (body: { code: string; name: string; description?: string; extraAttrs?: string }) =>
    post<RoleView>('/console/roles', body),
  update: (id: string, body: { name?: string; description?: string; extraAttrs?: string }) =>
    put<RoleView>(`/console/roles/${id}`, body),
  remove: (id: string) => del<void>(`/console/roles/${id}`),
  bindPermission: (roleId: string, permissionId: string) =>
    post<void>(`/console/roles/${roleId}/permissions`, { permissionId }),
  unbindPermission: (roleId: string, permissionId: string) =>
    del<void>(`/console/roles/${roleId}/permissions/${permissionId}`),
}

export const permissionApi = {
  page: (page: number, size: number, keyword?: string, sourceType?: string, resourceType?: string) =>
    get<PageData<PermissionView>>(`/console/permissions${q({ page, size, keyword, sourceType, resourceType })}`),
  create: (body: { code: string; name: string; description?: string; resourceType?: string; extraAttrs?: string }) =>
    post<PermissionView>('/console/permissions', body),
  update: (id: string, body: { name?: string; description?: string; resourceType?: string; extraAttrs?: string }) =>
    put<PermissionView>(`/console/permissions/${id}`, body),
  remove: (id: string) => del<void>(`/console/permissions/${id}`),
}

export const dataSourceApi = {
  list: () => get<DataSourceView[]>('/console/datasources'),
  create: (body: unknown) => post<DataSourceView>('/console/datasources', body),
  update: (id: string, body: unknown) => put<DataSourceView>(`/console/datasources/${id}`, body),
  remove: (id: string) => del<void>(`/console/datasources/${id}`),
  test: (id: string) => post<{ connected: boolean; costMs: number }>(`/console/datasources/${id}/test`),
  mappings: (dsId: string) => get<SyncMapping[]>(`/console/datasources/${dsId}/mappings`),
  createMapping: (dsId: string, body: unknown) => post<SyncMapping>(`/console/datasources/${dsId}/mappings`, body),
  updateMapping: (id: string, body: unknown) => put<SyncMapping>(`/console/mappings/${id}`, body),
  deleteMapping: (id: string) => del<void>(`/console/mappings/${id}`),
  runMapping: (id: string) => post<SyncLog>(`/console/mappings/${id}/run`),
  runDataSource: (dsId: string) => post<SyncLog[]>(`/console/datasources/${dsId}/run`),
  sqlPreview: (dsId: string, sql: string, limit?: number) =>
    post<SqlPreviewResult>(`/console/datasources/${dsId}/sql-preview`, { sql, limit }),
  syncLogs: (dataSourceId?: string, page = 0, size = 20) =>
    get<PageData<SyncLog>>(`/console/sync-logs${q({ dataSourceId, page, size })}`),
}

export const pushApi = {
  targets: () => get<PushTargetView[]>('/console/push/targets'),
  create: (body: unknown) => post<PushTargetView>('/console/push/targets', body),
  update: (id: string, body: unknown) => put<PushTargetView>(`/console/push/targets/${id}`, body),
  remove: (id: string) => del<void>(`/console/push/targets/${id}`),
  fullPush: (id: string) => post<{ accepted: boolean; message: string }>(`/console/push/targets/${id}/full-push`),
  logs: (targetId?: string, page = 0, size = 20) =>
    get<PageData<PushLog>>(`/console/push/logs${q({ targetId, page, size })}`),
  retry: (logId: number) => post<PushLog>(`/console/push/logs/${logId}/retry`),
}

export const clientApi = {
  list: () => get<ClientView[]>('/console/clients'),
  create: (body: unknown) => post<{ client: ClientView; clientSecret: string; warning: string }>('/console/clients', body),
  update: (id: string, body: unknown) => put<ClientView>(`/console/clients/${id}`, body),
  remove: (id: string) => del<void>(`/console/clients/${id}`),
  resetKey: (id: string) => post<{ clientId: string; apiKey: string }>(`/console/clients/${id}/reset-key`),
  accessLogs: (clientId?: string, page = 0, size = 20) =>
    get<PageData<ApiAccessLog>>(`/console/clients/access-logs${q({ clientId, page, size })}`),
}

export const auditApi = {
  page: (page: number, size: number, entityType?: string, sinceMillis?: number) =>
    get<PageData<AuditLog>>(`/console/audit${q({ page, size, entityType, sinceMillis })}`),
}
