import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { dataSourceApi } from '../api'
import { fmtTime } from '../api/client'
import type { DataSourceView, SqlPreviewResult, SyncLog, SyncMapping } from '../api/types'
import {
  Badge, Button, Card, ErrorBlock, Field, Loading, Modal, Pagination, Select,
  StatusBadge, Table, TextInput, cls, toast,
} from '../components/ui'

const DB_TYPES = ['MYSQL', 'ORACLE', 'POSTGRESQL', 'MARIADB', 'SQLSERVER']
const ENTITY_TYPES = ['USER', 'ROLE', 'PERMISSION', 'USER_ROLE', 'ROLE_PERMISSION']

/* -------- 表单类型定义 -------- */
type DsForm = {
  name: string
  dbType: string
  jdbcUrl: string
  username: string
  password: string
  enabled: boolean | string
  scheduleCron: string
  connectTimeoutSeconds: number
  notes: string
}

type Tab = 'list' | 'logs'

export default function DataSources() {
  const [tab, setTab] = useState<Tab>('list')
  const [editing, setEditing] = useState<DataSourceView | 'new' | null>(null)
  const [detail, setDetail] = useState<DataSourceView | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">数据源与同步</h2>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
            {(['list', 'logs'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cls('rounded px-3 py-1.5 text-sm', tab === t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                {t === 'list' ? '数据源' : '同步日志'}
              </button>
            ))}
          </div>
          {tab === 'list' && <Button onClick={() => setEditing('new')}>新建数据源</Button>}
        </div>
      </div>

      {tab === 'list' ? (
        <DataSourceList onEdit={setEditing} onDetail={setDetail} />
      ) : (
        <SyncLogPanel />
      )}

      {editing && (
        <DataSourceFormModal
          ds={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {detail && <DataSourceDetail ds={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ================= 数据源列表 ================= */

function DataSourceList({ onEdit, onDetail }: {
  onEdit: (ds: DataSourceView) => void
  onDetail: (ds: DataSourceView) => void
}) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['datasources'], queryFn: dataSourceApi.list })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['datasources'] })

  const removeMut = useMutation({
    mutationFn: (id: string) => dataSourceApi.remove(id),
    onSuccess: () => { toast('已删除'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const testMut = useMutation({
    mutationFn: (id: string) => dataSourceApi.test(id),
    onSuccess: (d) => toast(`连接成功，耗时 ${d.costMs}ms`),
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const runMut = useMutation({
    mutationFn: (id: string) => dataSourceApi.runDataSource(id),
    onSuccess: (logs) => {
      const failed = logs.filter((l) => l.status === 'FAILED').length
      toast(failed ? `${logs.length} 个任务完成，${failed} 个失败，详见同步日志` : `${logs.length} 个映射任务已执行`, failed ? 'error' : 'success')
      qc.invalidateQueries({ queryKey: ['sync-logs'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorBlock error={query.error} />

  return (
    <Card>
      <Table
        rows={query.data ?? []}
        empty="暂无数据源，点击右上角「新建数据源」接入第三方数据库"
        columns={[
          { title: '名称', render: (d: DataSourceView) => <span className="font-medium">{d.name}</span> },
          { title: '类型', render: (d: DataSourceView) => <Badge color="blue">{d.dbType}</Badge> },
          {
            title: '连接',
            render: (d: DataSourceView) => (
              <div>
                <div className="max-w-xs truncate font-mono text-xs text-slate-500" title={d.jdbcUrl}>{d.jdbcUrl}</div>
                <div className="text-xs text-slate-400">{d.username || '-'}</div>
              </div>
            ),
          },
          { title: '定时', render: (d: DataSourceView) => <span className="font-mono text-xs">{d.scheduleCron || '-'}</span> },
          { title: '状态', render: (d: DataSourceView) => <StatusBadge ok={d.enabled} /> },
          {
            title: '操作',
            render: (d: DataSourceView) => (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onDetail(d)}>映射任务</Button>
                <Button size="sm" variant="secondary" onClick={() => testMut.mutate(d.id)} disabled={testMut.isPending}>测试连接</Button>
                <Button size="sm" variant="secondary" onClick={() => runMut.mutate(d.id)} disabled={runMut.isPending || !d.enabled}>
                  {runMut.isPending ? '同步中…' : '手动同步'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onEdit(d)}>编辑</Button>
                <Button size="sm" variant="danger" onClick={() => {
                  if (confirm(`确认删除数据源「${d.name}」？其映射任务将一并删除。`)) removeMut.mutate(d.id)
                }}>删除</Button>
              </div>
            ),
          },
        ]}
      />
    </Card>
  )
}

/* ================= 数据源表单（React Hook Form 原生校验，规格文档 3.1） ================= */

function DataSourceFormModal({ ds, onClose }: { ds: DataSourceView | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DsForm>({
    mode: 'onSubmit',
    defaultValues: {
      name: ds?.name ?? '',
      dbType: ds?.dbType ?? 'MYSQL',
      jdbcUrl: ds?.jdbcUrl ?? '',
      username: ds?.username ?? '',
      password: '',
      enabled: ds?.enabled ?? true,
      scheduleCron: ds?.scheduleCron ?? '',
      connectTimeoutSeconds: ds?.connectTimeoutSeconds ?? 10,
      notes: ds?.notes ?? '',
    },
  })

  const submit = async (form: DsForm) => {
    const body = {
      ...form,
      scheduleCron: form.scheduleCron.trim() || null,
      notes: form.notes.trim() || null,
      password: form.password.trim() || undefined, // 编辑时空密码表示保持原值
    }
    try {
      if (ds) {
        await dataSourceApi.update(ds.id, body)
      } else {
        await dataSourceApi.create(body)
      }
      toast(ds ? '已更新' : '已创建')
      qc.invalidateQueries({ queryKey: ['datasources'] })
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    }
  }

  return (
    <Modal open title={ds ? '编辑数据源' : '新建数据源'} onClose={onClose} wide>
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-2 gap-4">
        <Field label="名称" required error={errors.name?.message}>
          <TextInput {...register('name', { required: '请输入名称', maxLength: 100 })} placeholder="如：HIS 系统库" />
        </Field>
        <Field label="数据库类型" required error={errors.dbType?.message}>
          <Select {...register('dbType', { validate: (v) => DB_TYPES.includes(v) || '请选择数据库类型' })}>
            {DB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="JDBC URL" required error={errors.jdbcUrl?.message}>
            <TextInput {...register('jdbcUrl', { required: '请输入 JDBC URL', maxLength: 500 })} placeholder="jdbc:mysql://host:3306/db" className="font-mono !text-xs" />
          </Field>
        </div>
        <Field label="用户名">
          <TextInput {...register('username')} />
        </Field>
        <Field label="密码" hint={ds ? '留空表示保持原密码（加密存储，页面永不明文展示）' : '加密存储'}>
          <TextInput {...register('password')} type="password" autoComplete="new-password" />
        </Field>
        <Field label="定时 Cron（可选）" hint="如 0 0/30 * * * * 每 30 分钟一次；留空则仅手动触发">
          <TextInput {...register('scheduleCron')} className="font-mono !text-xs" />
        </Field>
        <Field label="连接超时（秒）" error={errors.connectTimeoutSeconds?.message}>
          <TextInput {...register('connectTimeoutSeconds', {
            setValueAs: (v) => {
              if (v === '' || v === undefined || v === null) return 10
              const n = Number(v)
              if (Number.isNaN(n)) return 10
              return Math.min(600, Math.max(1, Math.round(n)))
            },
          })} type="number" />
        </Field>
        <div className="col-span-2">
          <Field label="备注">
            <TextInput {...register('notes')} />
          </Field>
        </div>
        <Field label="状态">
          <Select {...register('enabled', { setValueAs: (v) => v === true || v === 'true' })}>
            <option value="true">启用</option>
            <option value="false">停用</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? '保存中…' : '保存'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ================= 数据源详情：映射任务 + SQL 调试 ================= */

function DataSourceDetail({ ds, onClose }: { ds: DataSourceView; onClose: () => void }) {
  const qc = useQueryClient()
  const mappings = useQuery({ queryKey: ['mappings', ds.id], queryFn: () => dataSourceApi.mappings(ds.id) })
  const [editingMapping, setEditingMapping] = useState<SyncMapping | 'new' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['mappings', ds.id] })

  const removeMut = useMutation({
    mutationFn: (id: string) => dataSourceApi.deleteMapping(id),
    onSuccess: () => { toast('已删除'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const runMut = useMutation({
    mutationFn: (id: string) => dataSourceApi.runMapping(id),
    onSuccess: (log) => {
      if (log.status === 'SUCCESS') {
        toast(`同步完成：新增 ${log.insertedCount} · 更新 ${log.updatedCount} · 跳过 ${log.skippedCount}`, 'success')
      } else {
        toast(`同步失败：${log.errorDetail ?? '未知错误'}`, 'error')
      }
      invalidate()
      qc.invalidateQueries({ queryKey: ['sync-logs'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <Modal open title={`数据源「${ds.name}」的映射任务`} onClose={onClose} wide>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setPreviewOpen(true)}>SQL 在线调试</Button>
        <Button onClick={() => setEditingMapping('new')}>新建映射</Button>
      </div>

      {mappings.isLoading ? (
        <Loading />
      ) : (
        <Table
          rows={mappings.data ?? []}
          empty="暂无映射任务"
          columns={[
            { title: '名称', render: (m: SyncMapping) => <span className="font-medium">{m.name}</span> },
            { title: '目标实体', render: (m: SyncMapping) => <Badge color="purple">{m.targetEntity}</Badge> },
            { title: '模式', render: (m: SyncMapping) => <Badge color={m.syncMode === 'INCREMENTAL' ? 'amber' : 'slate'}>{m.syncMode === 'INCREMENTAL' ? `增量 (${m.incrementalColumn ?? '?'})` : '全量'}</Badge> },
            { title: '冲突策略', render: (m: SyncMapping) => <span className="text-xs">{conflictLabel(m.conflictStrategy)}</span> },
            { title: '定时', render: (m: SyncMapping) => m.scheduleCron ? <span className="font-mono text-xs text-blue-600">{m.scheduleCron}</span> : <span className="text-xs text-slate-400">-</span> },
            { title: '增量水位', render: (m: SyncMapping) => <span className="font-mono text-xs">{m.lastSyncValue ?? '-'}</span> },
            { title: '状态', render: (m: SyncMapping) => <StatusBadge ok={m.enabled} /> },
            {
              title: '操作',
              render: (m: SyncMapping) => (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => runMut.mutate(m.id)} disabled={runMut.isPending}>
                    {runMut.isPending ? '执行中…' : '立即同步'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingMapping(m)}>编辑</Button>
                  <Button size="sm" variant="danger" onClick={() => {
                    if (confirm(`确认删除映射「${m.name}」？`)) removeMut.mutate(m.id)
                  }}>删除</Button>
                </div>
              ),
            },
          ]}
        />
      )}

      {editingMapping && (
        <MappingFormModal
          ds={ds}
          mapping={editingMapping === 'new' ? null : editingMapping}
          onClose={() => setEditingMapping(null)}
          onSaved={() => { setEditingMapping(null); invalidate() }}
        />
      )}
      {previewOpen && <SqlPreviewModal ds={ds} onClose={() => setPreviewOpen(false)} />}
    </Modal>
  )
}

function conflictLabel(v: string) {
  return { SYNC_OVERRIDE: '同步覆盖', NATIVE_PRIORITY: '原生优先', SKIP: '跳过' }[v] ?? v
}

/* ---------------- 映射表单 ---------------- */

type MappingForm = {
  name: string
  targetEntity: string
  sqlText: string
  fieldMapping: string
  conflictStrategy: string
  batchSize: number
  enabled: boolean | string
  syncMode: string
  incrementalColumn: string
  scheduleCron: string
}

type EntityFieldDef = { key: string; label: string; required: boolean; desc?: string }

/** 每种实体的目标字段定义（含标签、是否必填、说明） */
const ENTITY_FIELDS: Record<string, EntityFieldDef[]> = {
  USER: [
    { key: 'external_key', label: 'external_key', required: true, desc: '外部唯一标识，用于幂等 upsert（必填）' },
    { key: 'username', label: 'username', required: false, desc: '登录名 / 账号' },
    { key: 'display_name', label: 'display_name', required: false, desc: '显示名 / 真实姓名' },
    { key: 'status', label: 'status', required: false, desc: '账号状态（0/1 或 ENABLED/DISABLED）' },
    { key: 'password', label: 'password', required: false, desc: '密码' },
    { key: 'gender', label: 'gender', required: false, desc: '性别' },
    { key: 'department', label: 'department', required: false, desc: '科室 / 部门' },
    { key: 'position', label: 'position', required: false, desc: '岗位 / 职位' },
    { key: 'phone', label: 'phone', required: false, desc: '手机号' },
    { key: 'email', label: 'email', required: false, desc: '邮箱' },
    { key: 'avatar_url', label: 'avatar_url', required: false, desc: '头像 URL' },
    { key: 'extra_attrs', label: 'extra_attrs', required: false, desc: '扩展属性，未映射列自动收集' },
  ],
  ROLE: [
    { key: 'external_key', label: 'external_key', required: true, desc: '外部唯一标识（必填）' },
    { key: 'code', label: 'code', required: true, desc: '角色编码（必填）' },
    { key: 'name', label: 'name', required: false, desc: '角色名称' },
    { key: 'description', label: 'description', required: false, desc: '描述 / 备注' },
    { key: 'extra_attrs', label: 'extra_attrs', required: false, desc: '扩展属性，存入 JSON' },
  ],
  PERMISSION: [
    { key: 'external_key', label: 'external_key', required: true, desc: '外部唯一标识（必填）' },
    { key: 'code', label: 'code', required: true, desc: '权限编码（必填）' },
    { key: 'name', label: 'name', required: false, desc: '权限名称' },
    { key: 'description', label: 'description', required: false, desc: '描述 / 备注' },
    { key: 'resource_type', label: 'resource_type', required: false, desc: '资源类型' },
    { key: 'extra_attrs', label: 'extra_attrs', required: false, desc: '扩展属性，存入 JSON' },
  ],
  USER_ROLE: [
    { key: 'external_key', label: 'external_key', required: false, desc: '可选，用于幂等' },
    { key: 'user_external_key', label: 'user_external_key', required: true, desc: '用户的 external_key（必填）' },
    { key: 'role_external_key', label: 'role_external_key', required: true, desc: '角色的 external_key（必填）' },
  ],
  ROLE_PERMISSION: [
    { key: 'external_key', label: 'external_key', required: false, desc: '可选，用于幂等' },
    { key: 'role_external_key', label: 'role_external_key', required: true, desc: '角色的 external_key（必填）' },
    { key: 'permission_external_key', label: 'permission_external_key', required: true, desc: '权限的 external_key（必填）' },
  ],
}

/** 同义词表：目标字段 key → 可能的 SQL 列名片段（小写，不含下划线） */
const FIELD_SYNONYMS: Record<string, string[]> = {
  external_key: ['id', 'key', 'no', 'number', 'code', 'shortid', 'short_id', 'userid', 'user_id', 'urid', 'ur_id', 'rpid', 'rp_id'],
  username: ['username', 'user_name', 'login', 'loginname', 'login_name', 'account', 'usercode', 'user_code'],
  display_name: ['displayname', 'display_name', 'realname', 'real_name', 'username', 'user_name', 'name', 'fullname'],
  status: ['status', 'state', 'enabled', 'active', 'flag', 'deleted', 'deletedmark', 'deleted_mark'],
  password: ['password', 'pwd', 'passwd', 'secret'],
  gender: ['gender', 'sex', 'sexuality'],
  department: ['department', 'dept', 'unit', 'org', 'orgcode', 'org_code', 'deptcode', 'dept_code', 'unitcode', 'unit_code', 'branch'],
  position: ['position', 'post', 'title', 'job', 'jobtitle', 'job_title', 'duty'],
  phone: ['phone', 'mobile', 'tel', 'telephone', 'cellphone'],
  email: ['email', 'mail', 'e_mail'],
  avatar_url: ['avatar', 'avatarurl', 'avatar_url', 'photo', 'image', 'pic'],
  code: ['code', 'rolecode', 'role_code', 'permcode', 'perm_code', 'rolevode'],
  name: ['name', 'rolename', 'role_name', 'permname', 'perm_name', 'title'],
  description: ['description', 'desc', 'remark', 'memo', 'comment', 'note'],
  resource_type: ['resourcetype', 'resource_type', 'restype', 'res_type', 'type'],
  extra_attrs: ['extra', 'extraattrs', 'extra_attrs', 'attrs', 'json', 'ext'],
  user_external_key: ['userkey', 'user_key', 'empno', 'emp_no', 'userid', 'user_id'],
  role_external_key: ['rolekey', 'role_key', 'roleno', 'role_no', 'rolecode', 'role_code'],
  permission_external_key: ['permkey', 'perm_key', 'permno', 'perm_no', 'permcode', 'perm_code'],
}

function normalizeCol(s: string): string {
  return s.toLowerCase().replace(/[_-\s]/g, '')
}

/** 给定目标字段 key + SQL 列名，是否算匹配 */
function isFieldMatch(targetKey: string, sqlCol: string): boolean {
  const col = normalizeCol(sqlCol)
  const synonyms = FIELD_SYNONYMS[targetKey] ?? [targetKey]
  return synonyms.some((syn) => {
    const n = normalizeCol(syn)
    if (!n) return false
    // 精确命中
    if (col === n) return true
    // SQL 列名包含目标同义词
    if (col.includes(n)) return true
    // 目标同义词包含 SQL 列名
    if (n.includes(col)) return true
    return false
  })
}

/** 自动推断映射：目标字段 → SQL 列 */
function autoInfer(targetEntity: string, columns: string[]): Record<string, string> {
  const fields = ENTITY_FIELDS[targetEntity] ?? []
  const assigned = new Set<string>()
  const result: Record<string, string> = {}
  for (const f of fields) {
    const match = columns.find((c) => !assigned.has(c) && isFieldMatch(f.key, c))
    if (match) {
      result[f.key] = match
      assigned.add(match)
    }
  }
  return result
}

function MappingFormModal({ ds, mapping, onClose, onSaved }: {
  ds: DataSourceView; mapping: SyncMapping | null; onClose: () => void; onSaved: () => void
}) {
  const ENTITY_VALUES = ['USER', 'ROLE', 'PERMISSION', 'USER_ROLE', 'ROLE_PERMISSION']
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<MappingForm>({
    mode: 'onSubmit',
    defaultValues: {
      name: mapping?.name ?? '',
      targetEntity: mapping?.targetEntity ?? 'USER',
      sqlText: mapping?.sqlText ?? 'SELECT ',
      fieldMapping: mapping?.fieldMapping ?? '{}',
      conflictStrategy: mapping?.conflictStrategy ?? 'SYNC_OVERRIDE',
      batchSize: mapping?.batchSize ?? 500,
      enabled: mapping?.enabled ?? true,
      syncMode: mapping?.syncMode ?? 'FULL',
      incrementalColumn: mapping?.incrementalColumn ?? '',
      scheduleCron: mapping?.scheduleCron ?? '',
    },
  })
  const sqlText = watch('sqlText')
  const targetEntity = watch('targetEntity')
  const syncMode = watch('syncMode')
  const isIncremental = syncMode === 'INCREMENTAL'

  // 内部状态
  const [sqlColumns, setSqlColumns] = useState<string[]>([])
  const [previewRow, setPreviewRow] = useState<Record<string, string | null> | null>(null)
  const [mappingObj, setMappingObj] = useState<Record<string, string>>(() => {
    try { return JSON.parse(mapping?.fieldMapping ?? '{}') } catch { return {} }
  })
  const [inferring, setInferring] = useState(false)
  const [showJson, setShowJson] = useState(false)

  // 切换目标实体时清空映射（新建场景）
  const onEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value
    setValue('targetEntity', t)
    if (!mapping) {
      setMappingObj({})
      setSqlColumns([])
      setPreviewRow(null)
    }
  }

  const runInfer = async () => {
    if (!sqlText || sqlText.trim().length < 6) {
      toast('请先写好 SQL', 'error')
      return
    }
    setInferring(true)
    try {
      const res = await dataSourceApi.sqlPreview(ds.id, sqlText, 5)
      const cols = res.rows && res.rows.length > 0 ? Object.keys(res.rows[0]) : []
      setSqlColumns(cols)
      setPreviewRow(res.rows && res.rows.length > 0 ? res.rows[0] : null)
      const inferred = autoInfer(targetEntity, cols)
      setMappingObj(inferred)
      toast(`预览成功（${res.rowCount} 行 / ${cols.length} 列），已自动推断 ${Object.keys(inferred).length} 个字段映射`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'SQL 预览失败', 'error')
    } finally {
      setInferring(false)
    }
  }

  const updateMapping = (targetKey: string, sqlCol: string) => {
    setMappingObj((prev) => {
      const next = { ...prev }
      if (sqlCol === '' || sqlCol === null || sqlCol === undefined) {
        delete next[targetKey]
      } else {
        next[targetKey] = sqlCol
      }
      return next
    })
  }

  const submit = async (form: MappingForm) => {
    // 校验必填 external_key
    const fields = ENTITY_FIELDS[form.targetEntity] ?? []
    const missingReq = fields.filter((f) => f.required && !mappingObj[f.key])
    if (missingReq.length > 0) {
      toast(`请先完成必填字段映射：${missingReq.map((f) => f.key).join(', ')}`, 'error')
      return
    }
    const payload: MappingForm = {
      ...form,
      fieldMapping: JSON.stringify(mappingObj),
      incrementalColumn: form.incrementalColumn.trim() || '',
      scheduleCron: form.scheduleCron.trim() || '',
    }
    try {
      if (mapping) {
        await dataSourceApi.updateMapping(mapping.id, payload)
      } else {
        await dataSourceApi.createMapping(ds.id, payload)
      }
      toast(mapping ? '已更新' : '已创建')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    }
  }

  const entityFields = ENTITY_FIELDS[targetEntity] ?? []
  const mappedCount = Object.keys(mappingObj).length
  const requiredMissing = entityFields.filter((f) => f.required && !mappingObj[f.key]).length

  return (
    <Modal open title={mapping ? '编辑映射任务' : '新建映射任务'} onClose={onClose} wide>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="名称" required error={errors.name?.message}>
            <TextInput {...register('name', { required: '请输入名称', maxLength: 100 })} placeholder="如：HIS 用户同步" />
          </Field>
          <Field label="目标实体" required error={errors.targetEntity?.message}>
            <Select {...register('targetEntity', {
              validate: (v) => ENTITY_VALUES.includes(v) || '请选择目标实体',
            })} onChange={onEntityChange}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="冲突策略" error={errors.conflictStrategy?.message}>
            <Select {...register('conflictStrategy', {
              validate: (v) => ['SYNC_OVERRIDE', 'NATIVE_PRIORITY', 'SKIP'].includes(v) || '请选择冲突策略',
            })}>
              <option value="SYNC_OVERRIDE">同步覆盖</option>
              <option value="NATIVE_PRIORITY">原生优先</option>
              <option value="SKIP">跳过</option>
            </Select>
          </Field>
        </div>

        <Field label="拉取 SQL（只读，支持 :lastSyncTime 增量占位符）" required error={errors.sqlText?.message}>
          <div className="overflow-hidden rounded-md border border-slate-300">
            <CodeMirror
              value={sqlText}
              height="140px"
              extensions={[sql()]}
              onChange={(v) => setValue('sqlText', v, { shouldValidate: true })}
            />
          </div>
        </Field>

        {/* 图形化字段映射 */}
        <Field
          label={<>字段映射 <span className="ml-2 text-xs font-normal text-slate-500">已映射 {mappedCount}/{entityFields.length}{requiredMissing > 0 && <span className="ml-1 text-amber-600">· 缺 {requiredMissing} 个必填</span>}</span></>}
          hint={
            sqlColumns.length > 0
              ? `SQL 列：${sqlColumns.join(' · ')}`
              : '点下方「预览并自动推断」按钮，执行 SQL 后自动匹配字段'
          }
        >
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            {/* 操作栏 */}
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                type="button"
                size="sm"
                disabled={inferring}
                onClick={runInfer}
              >
                {inferring ? '预览中…' : '🔍 预览并自动推断'}
              </Button>
              <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setShowJson((v) => !v)}>
                {showJson ? '隐藏原始 JSON' : '查看原始 JSON'}
              </button>
            </div>

            {/* 映射表格 */}
            {sqlColumns.length > 0 || mappingObj ? (
              <div className="overflow-hidden rounded border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">目标字段</th>
                      <th className="px-3 py-2 text-left font-medium">SQL 列</th>
                      <th className="px-3 py-2 text-left font-medium">样例值</th>
                      <th className="px-3 py-2 text-left font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {entityFields.map((f) => {
                      const selected = mappingObj[f.key] ?? ''
                      const missing = f.required && !selected
                      const sampleVal = selected && previewRow ? previewRow[selected] : undefined
                      return (
                        <tr key={f.key} className={missing ? 'bg-amber-50' : ''}>
                          <td className="px-3 py-2 font-mono text-xs">
                            {f.required && <span className="mr-0.5 text-red-500">*</span>}
                            {f.key}
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={selected}
                              onChange={(e) => updateMapping(f.key, e.target.value)}
                              className={cls(missing && '!border-amber-400 focus:!border-amber-500')}
                            >
                              <option value="">— 不映射 —</option>
                              {sqlColumns.length > 0 ? (
                                sqlColumns.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))
                              ) : (
                                mappingObj[f.key] && <option value={mappingObj[f.key]}>{mappingObj[f.key]}</option>
                              )}
                            </Select>
                          </td>
                          <td className="px-3 py-2 max-w-[160px] truncate text-xs text-slate-500" title={sampleVal ?? undefined}>
                            {sampleVal !== undefined
                              ? (sampleVal === null || sampleVal === '' ? <span className="italic text-slate-300">null</span> : <span className="text-slate-700">{String(sampleVal)}</span>)
                              : <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">{f.desc}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* 预览数据行 */}
                {previewRow && sqlColumns.length > 0 && (
                  <div className="border-t border-slate-200 bg-slate-900/95 px-3 py-2">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      预览数据 · 第 1 行（{Object.keys(previewRow).length} 列）
                    </div>
                    <div className="overflow-x-auto">
                      <div className="flex gap-3 text-xs">
                        {sqlColumns.map((c) => (
                          <div key={c} className="flex-shrink-0">
                            <span className="text-sky-400">{c}</span>
                            <span className="text-slate-500">: </span>
                            <span className={cls(previewRow[c] === null || previewRow[c] === '' ? 'text-slate-400 italic' : 'text-amber-300')}>
                              {previewRow[c] === null ? 'NULL' : previewRow[c] === '' ? '(空)' : String(previewRow[c])}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400">
                点「预览并自动推断」执行 SQL，从列名智能匹配映射
              </div>
            )}

            {/* 原始 JSON */}
            {showJson && (
              <div className="mt-2 rounded border border-slate-200 bg-slate-900 p-2">
                <pre className="overflow-x-auto text-xs text-green-300">{JSON.stringify(mappingObj, null, 2)}</pre>
              </div>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-3 items-end gap-4">
          <Field label="批大小" error={errors.batchSize?.message}>
            <TextInput {...register('batchSize', {
              setValueAs: (v) => {
                if (v === '' || v === undefined || v === null) return 500
                const n = Number(v)
                if (Number.isNaN(n)) return 500
                return Math.min(5000, Math.max(1, Math.round(n)))
              },
            })} type="number" />
          </Field>
          <Field label="同步模式">
            <Select {...register('syncMode', { validate: (v) => ['FULL', 'INCREMENTAL'].includes(v) || '请选择同步模式' })}>
              <option value="FULL">全量</option>
              <option value="INCREMENTAL">增量</option>
            </Select>
          </Field>
          <Field label="启用">
            <Select {...register('enabled', { setValueAs: (v) => v === true || v === 'true' })}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </Select>
          </Field>
          <Field label="增量字段" error={errors.incrementalColumn?.message}
            hint={isIncremental ? '如 UPDATE_ON；或在 SQL 中使用 :lastSyncTime 占位符' : '仅增量模式需要'}>
            <TextInput
              {...register('incrementalColumn', {
                required: isIncremental ? '增量模式需要填写增量字段' : undefined,
              })}
              disabled={!isIncremental}
              placeholder={isIncremental ? '如 UPDATE_ON' : '切换到「增量」模式后可编辑'}
            />
          </Field>
          <Field label="定时 Cron（可选）" hint="如 0 0/30 * * * * 每 30 分钟一次；留空则跟随数据源调度或仅手动触发" className="col-span-2">
            <TextInput {...register('scheduleCron')} className="font-mono !text-xs" placeholder="0 0/30 * * * *" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pb-1">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? '保存中…' : '保存'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------- SQL 在线调试预览（规格文档 5.1.1 / 9） ---------------- */

function SqlPreviewModal({ ds, onClose }: { ds: DataSourceView; onClose: () => void }) {
  const [sqlText, setSqlText] = useState('SELECT ')
  const [limit, setLimit] = useState(20)
  const [result, setResult] = useState<SqlPreviewResult | null>(null)

  const run = useMutation({
    mutationFn: () => dataSourceApi.sqlPreview(ds.id, sqlText, limit),
    onSuccess: (d) => setResult(d),
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const cols = result?.rows?.[0] ? Object.keys(result.rows[0]) : []

  return (
    <Modal open title={`SQL 在线调试（${ds.name}）`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-md border border-slate-300">
          <CodeMirror value={sqlText} height="140px" extensions={[sql()]} onChange={setSqlText} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            限行
            <TextInput type="number" className="!w-20" value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(100, Number(e.target.value) || 20)))} />
            <span className="text-xs text-slate-400">（最大 100）</span>
          </div>
          <Button onClick={() => run.mutate()} disabled={run.isPending || !sqlText.trim()}>
            {run.isPending ? '执行中…' : '执行预览'}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500">
              返回 {result.rowCount} 行 · 耗时 {result.costMs}ms
            </div>
            <pre className="max-h-24 overflow-auto rounded bg-slate-50 p-2 font-mono text-xs text-slate-500">{result.executedSql}</pre>
            <div className="max-h-64 overflow-auto rounded border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-500">
                    {cols.map((c) => <th key={c} className="px-2 py-1.5 font-medium whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {cols.map((c) => <td key={c} className="px-2 py-1.5 font-mono whitespace-nowrap">{r[c] ?? <span className="text-slate-300">NULL</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ================= 同步日志 ================= */

function SyncLogPanel() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const datasources = useQuery({ queryKey: ['datasources'], queryFn: dataSourceApi.list })
  const [dsFilter, setDsFilter] = useState('')
  const query = useQuery({
    queryKey: ['sync-logs', page, dsFilter],
    queryFn: () => dataSourceApi.syncLogs(dsFilter || undefined, page, 20),
    refetchInterval: 5000,
  })

  const statusBadge = (s: SyncLog['status']) =>
    s === 'SUCCESS' ? <Badge color="green">成功</Badge>
      : s === 'FAILED' ? <Badge color="red">失败</Badge>
        : <Badge color="amber">执行中</Badge>

  return (
    <Card
      title="同步日志"
      extra={
        <div className="flex items-center gap-2">
          <Select className="!w-48" value={dsFilter} onChange={(e) => { setDsFilter(e.target.value); setPage(0) }}>
            <option value="">全部数据源</option>
            {(datasources.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ['sync-logs'] })}>刷新</Button>
        </div>
      }
    >
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorBlock error={query.error} />
      ) : (
        <>
          <Table
            rows={query.data?.items ?? []}
            columns={[
              { title: '映射任务', render: (l: SyncLog) => <span className="font-medium">{l.mappingName}</span> },
              { title: '状态', render: (l: SyncLog) => statusBadge(l.status) },
              { title: '触发', render: (l: SyncLog) => <Badge color={l.trigger === 'MANUAL' ? 'blue' : 'slate'}>{l.trigger === 'MANUAL' ? '手动' : '定时'}</Badge> },
              {
                title: '新增/更新/跳过/失败',
                render: (l: SyncLog) => (
                  <span className="font-mono text-xs">
                    <span className="text-emerald-600">{l.insertedCount}</span> / <span className="text-blue-600">{l.updatedCount}</span> /{' '}
                    <span className="text-slate-500">{l.skippedCount}</span> / <span className="text-red-600">{l.failedCount}</span>
                  </span>
                ),
              },
              { title: '耗时', render: (l: SyncLog) => (l.durationMs != null ? `${l.durationMs}ms` : '-') },
              { title: '开始时间', render: (l: SyncLog) => fmtTime(l.startedAt) },
              {
                title: '错误信息',
                render: (l: SyncLog) => l.errorDetail
                  ? <span className="block max-w-xs truncate text-xs text-red-600" title={l.errorDetail}>{l.errorDetail}</span>
                  : '-',
              },
            ]}
          />
          <Pagination page={page} total={query.data?.total ?? 0} size={20} onChange={setPage} />
        </>
      )}
    </Card>
  )
}
