import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
          { title: '模式', render: (d: DataSourceView) => <Badge color={d.syncMode === 'INCREMENTAL' ? 'amber' : 'slate'}>{d.syncMode === 'INCREMENTAL' ? '增量' : '全量'}</Badge> },
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

/* ================= 数据源表单（React Hook Form + Zod，规格文档 3.1） ================= */

const dsSchema = z.object({
  name: z.string().min(1, '请输入名称'),
  dbType: z.enum(['MYSQL', 'ORACLE', 'POSTGRESQL', 'MARIADB', 'SQLSERVER'], { errorMap: () => ({ message: '请选择数据库类型' }) }),
  jdbcUrl: z.string().min(1, '请输入 JDBC URL'),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  enabled: z.boolean(),
  scheduleCron: z.string().optional().default(''),
  syncMode: z.enum(['FULL', 'INCREMENTAL']),
  incrementalColumn: z.string().optional().default(''),
  connectTimeoutSeconds: z.coerce.number().transform((v) => {
    if (Number.isNaN(v)) return 10
    return Math.min(600, Math.max(1, v))
  }),
  notes: z.string().optional().default(''),
})

type DsForm = z.infer<typeof dsSchema>

function DataSourceFormModal({ ds, onClose }: { ds: DataSourceView | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<DsForm>({
    resolver: zodResolver(dsSchema),
    mode: 'onChange',
    defaultValues: {
      name: ds?.name ?? '',
      dbType: ds?.dbType ?? 'MYSQL',
      jdbcUrl: ds?.jdbcUrl ?? '',
      username: ds?.username ?? '',
      password: '',
      enabled: ds?.enabled ?? true,
      scheduleCron: ds?.scheduleCron ?? '',
      syncMode: ds?.syncMode ?? 'FULL',
      incrementalColumn: ds?.incrementalColumn ?? '',
      connectTimeoutSeconds: ds?.connectTimeoutSeconds ?? 10,
      notes: ds?.notes ?? '',
    },
  })
  const syncMode = watch('syncMode')
  const isIncremental = syncMode === 'INCREMENTAL'

  const onSyncModeChange = (v: string) => {
    setValue('syncMode', v as DsForm['syncMode'], { shouldValidate: true })
    // 切换到全量时清空增量字段值；切换到增量时保留用户已填的值
    if (v === 'FULL') setValue('incrementalColumn', '', { shouldValidate: false })
  }

  const submit = async (form: DsForm) => {
    const body = {
      ...form,
      scheduleCron: form.scheduleCron.trim() || null,
      incrementalColumn: form.incrementalColumn.trim() || null,
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
          <TextInput {...register('name')} placeholder="如：HIS 系统库" />
        </Field>
        <Field label="数据库类型" required error={errors.dbType?.message}>
          <Select {...register('dbType')}>
            {DB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="JDBC URL" required error={errors.jdbcUrl?.message}>
            <TextInput {...register('jdbcUrl')} placeholder="jdbc:mysql://host:3306/db" className="font-mono !text-xs" />
          </Field>
        </div>
        <Field label="用户名">
          <TextInput {...register('username')} />
        </Field>
        <Field label="密码" hint={ds ? '留空表示保持原密码（加密存储，页面永不明文展示）' : '加密存储'}>
          <TextInput {...register('password')} type="password" autoComplete="new-password" />
        </Field>
        <Field label="同步模式">
          <Select
            {...register('syncMode')}
            onChange={(e) => onSyncModeChange(e.target.value)}
          >
            <option value="FULL">全量</option>
            <option value="INCREMENTAL">增量</option>
          </Select>
        </Field>
        <Field label="增量字段" error={errors.incrementalColumn?.message}
          hint={isIncremental ? '如 update_time；或在映射 SQL 中使用 :lastSyncTime 占位符' : '仅增量模式需要'}>
          <TextInput
            {...register('incrementalColumn')}
            disabled={!isIncremental}
            placeholder={isIncremental ? '如 update_time' : '切换到「增量」模式后可编辑'}
          />
        </Field>
        <Field label="定时 Cron（可选）" hint="如 0 0/30 * * * * 每 30 分钟一次；留空则仅手动触发">
          <TextInput {...register('scheduleCron')} className="font-mono !text-xs" />
        </Field>
        <Field label="连接超时（秒）" error={errors.connectTimeoutSeconds?.message}>
          <TextInput {...register('connectTimeoutSeconds')} type="number" />
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
            { title: '冲突策略', render: (m: SyncMapping) => <span className="text-xs">{conflictLabel(m.conflictStrategy)}</span> },
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

const mappingSchema = z.object({
  name: z.string().min(1, '请输入名称'),
  targetEntity: z.enum(['USER', 'ROLE', 'PERMISSION', 'USER_ROLE', 'ROLE_PERMISSION']),
  sqlText: z.string().min(1, '请输入 SQL').refine((s) => /^\s*(select|with)/i.test(s), '仅允许 SELECT / WITH 开头的只读语句'),
  fieldMapping: z.string().min(1, '请输入字段映射').refine((s) => {
    try {
      const o = JSON.parse(s)
      return typeof o === 'object' && o !== null && !Array.isArray(o)
    } catch {
      return false
    }
  }, '必须是 JSON 对象，如 {"external_key":"emp_no","username":"login_name"}'),
  conflictStrategy: z.enum(['SYNC_OVERRIDE', 'NATIVE_PRIORITY', 'SKIP']),
  batchSize: z.coerce.number().min(1).max(5000),
  enabled: z.boolean(),
})

type MappingForm = z.infer<typeof mappingSchema>

const FIELD_MAPPING_HINT: Record<string, string> = {
  USER: '{"external_key":"emp_no","username":"login_name","display_name":"real_name","status":"status","extra_attrs":"json_col"}',
  ROLE: '{"external_key":"role_no","code":"role_code","name":"role_name","description":"remark"}',
  PERMISSION: '{"external_key":"perm_no","code":"perm_code","name":"perm_name","resource_type":"perm_type"}',
  USER_ROLE: '{"external_key":"ur_id","user_external_key":"emp_no","role_external_key":"role_no"}',
  ROLE_PERMISSION: '{"external_key":"rp_id","role_external_key":"role_no","permission_external_key":"perm_no"}',
}

function MappingFormModal({ ds, mapping, onClose, onSaved }: {
  ds: DataSourceView; mapping: SyncMapping | null; onClose: () => void; onSaved: () => void
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<MappingForm>({
    resolver: zodResolver(mappingSchema),
    defaultValues: {
      name: mapping?.name ?? '',
      targetEntity: mapping?.targetEntity ?? 'USER',
      sqlText: mapping?.sqlText ?? 'SELECT ',
      fieldMapping: mapping?.fieldMapping ?? FIELD_MAPPING_HINT.USER,
      conflictStrategy: mapping?.conflictStrategy ?? 'SYNC_OVERRIDE',
      batchSize: mapping?.batchSize ?? 500,
      enabled: mapping?.enabled ?? true,
    },
  })
  const sqlText = watch('sqlText')
  const targetEntity = watch('targetEntity')

  const submit = async (form: MappingForm) => {
    try {
      if (mapping) {
        await dataSourceApi.updateMapping(mapping.id, form)
      } else {
        await dataSourceApi.createMapping(ds.id, form)
      }
      toast(mapping ? '已更新' : '已创建（保存前已通过 SQL 只读校验）')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    }
  }

  return (
    <Modal open title={mapping ? '编辑映射任务' : '新建映射任务'} onClose={onClose} wide>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="名称" required error={errors.name?.message}>
            <TextInput {...register('name')} placeholder="如：HIS 用户同步" />
          </Field>
          <Field label="目标实体" required>
            <Select {...register('targetEntity')} onChange={(e) => {
              const t = e.target.value as MappingForm['targetEntity']
              setValue('targetEntity', t)
              if (!mapping) setValue('fieldMapping', FIELD_MAPPING_HINT[t])
            }}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="冲突策略">
            <Select {...register('conflictStrategy')}>
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

        <Field label="字段映射（目标字段 → SQL 列，JSON）" required error={errors.fieldMapping?.message}
          hint={`external_key 必填（幂等键）。${targetEntity} 参考：${FIELD_MAPPING_HINT[targetEntity]}`}>
          <textarea
            {...register('fieldMapping')}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-3 items-end gap-4">
          <Field label="批大小" error={errors.batchSize?.message}>
            <TextInput {...register('batchSize')} type="number" />
          </Field>
          <Field label="启用">
            <Select {...register('enabled', { setValueAs: (v) => v === true || v === 'true' })}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pb-1">
            <Button variant="secondary" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? '保存中…' : '保存'}</Button>
          </div>
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
