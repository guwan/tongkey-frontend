/** 与后端 DTO 对齐的类型定义 */

export type EntityType = 'USER' | 'ROLE' | 'PERMISSION'
export type SourceType = 'NATIVE' | 'SYNCED' | 'API'
export type EntityStatus = 'ACTIVE' | 'DISABLED'
export type ResourceType = 'MENU' | 'BUTTON' | 'API' | 'DATA' | 'OTHER'
export type ChangeAction = 'CREATE' | 'UPDATE' | 'DELETE'
export type DbType = 'MYSQL' | 'ORACLE' | 'POSTGRESQL' | 'MARIADB' | 'SQLSERVER'
export type SyncMode = 'FULL' | 'INCREMENTAL'
export type ConflictStrategy = 'SYNC_OVERRIDE' | 'NATIVE_PRIORITY' | 'SKIP'
export type PushAuthType = 'NONE' | 'BASIC' | 'BEARER' | 'HMAC_SIGNATURE'

export interface UserView {
  id: string
  username: string
  displayName: string | null
  status: EntityStatus
  sourceType: SourceType
  sourceId: string | null
  externalKey: string | null
  extraAttrs: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
}

export interface RoleView {
  id: string
  code: string
  name: string
  description: string | null
  sourceType: SourceType
  sourceId: string | null
  externalKey: string | null
  extraAttrs: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
}

export interface PermissionView {
  id: string
  code: string
  name: string
  description: string | null
  resourceType: ResourceType
  sourceType: SourceType
  sourceId: string | null
  externalKey: string | null
  extraAttrs: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
}

export interface UserDetail {
  user: UserView
  roles: RoleView[]
}

export interface RoleDetail {
  role: RoleView
  permissions: PermissionView[]
}

export interface DataSourceView {
  id: string
  name: string
  dbType: DbType
  jdbcUrl: string
  username: string | null
  enabled: boolean
  scheduleCron: string | null
  connectTimeoutSeconds: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SyncMapping {
  id: string
  dataSourceId: string
  name: string
  targetEntity: EntityType
  sqlText: string
  fieldMapping: string
  conflictStrategy: ConflictStrategy
  batchSize: number
  enabled: boolean
  syncMode: SyncMode
  incrementalColumn: string | null
  lastSyncValue: string | null
  createdAt: string
  updatedAt: string
}

export interface SyncLog {
  id: number
  mappingId: string
  dataSourceId: string
  mappingName: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
  trigger: 'MANUAL' | 'SCHEDULED'
  insertedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  errorDetail: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
}

export interface PushTargetView {
  id: string
  name: string
  endpointUrl: string
  httpMethod: string
  authType: PushAuthType
  hasAuthConfig: boolean
  triggerEvents: string | null
  entityScope: string | null
  payloadTemplate: string | null
  retryMax: number
  retryIntervalSeconds: number
  enabled: boolean
}

export interface PushLog {
  id: number
  targetId: string
  targetName: string
  triggerEvent: 'ON_INIT' | 'ON_CREATE' | 'ON_UPDATE' | 'ON_DELETE'
  entityType: EntityType
  entityId: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
  retryCount: number
  nextRetryAt: string | null
  requestUrl: string
  requestBody: string | null
  responseStatus: number | null
  responseBody: string | null
  errorMessage: string | null
  costMs: number | null
  createdAt: string
  updatedAt: string
}

export interface ClientView {
  id: string
  clientId: string
  name: string
  apiKey: string
  scopes: string
  qpsLimit: number
  requireSignature: boolean
  enabled: boolean
  createdAt: string
}

export interface ApiAccessLog {
  id: number
  clientId: string
  method: string
  path: string
  paramSummary: string | null
  httpStatus: number
  costMs: number
  remoteIp: string | null
  createdAt: string
}

export interface AuditLog {
  id: number
  channel: string
  operator: string
  entityType: EntityType
  entityId: string
  entityCode: string | null
  action: ChangeAction
  detail: string | null
  createdAt: string
}

export interface SqlPreviewResult {
  executedSql: string
  rowCount: number
  costMs: number
  rows: Array<Record<string, string | null>>
}

export interface DashboardData {
  domain: {
    users: number
    roles: number
    permissions: number
    nativeUsers: number
    syncedUsers: number
    apiUsers: number
  }
  datasources: number
  syncMappings: number
  pushTargets: number
  sync: { success7d: number; failed7d: number; successRate7d: number }
  push: { success7d: number; failed7d: number; pending7d: number; successRate7d: number }
  serverTimeMillis: number
}
