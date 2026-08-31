import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pushApi } from '../api'
import { fmtTime } from '../api/client'
import type { PushLog, PushTargetView } from '../api/types'
import {
  Badge, Button, Card, ErrorBlock, Field, Loading, Modal, Pagination, Select,
  StatusBadge, Table, TextArea, TextInput, cls, toast,
} from '../components/ui'

const TRIGGER_EVENTS = ['ON_INIT', 'ON_CREATE', 'ON_UPDATE', 'ON_DELETE']
const AUTH_TYPES = ['NONE', 'BASIC', 'BEARER', 'HMAC_SIGNATURE']

export default function Push() {
  const [tab, setTab] = useState<'targets' | 'logs'>('targets')
  const [editing, setEditing] = useState<PushTargetView | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">推送管理</h2>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
            {(['targets', 'logs'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cls('rounded px-3 py-1.5 text-sm', tab === t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                {t === 'targets' ? '推送目标' : '推送日志'}
              </button>
            ))}
          </div>
          {tab === 'targets' && <Button onClick={() => setEditing('new')}>新建推送目标</Button>}
        </div>
      </div>

      {tab === 'targets' ? <TargetList onEdit={setEditing} /> : <PushLogPanel />}

      {editing && (
        <TargetFormModal target={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

/* ================= 推送目标 ================= */

function TargetList({ onEdit }: { onEdit: (t: PushTargetView) => void }) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['push-targets'], queryFn: pushApi.targets })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['push-targets'] })

  const removeMut = useMutation({
    mutationFn: (id: string) => pushApi.remove(id),
    onSuccess: () => { toast('已删除'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const fullPushMut = useMutation({
    mutationFn: (id: string) => pushApi.fullPush(id),
    onSuccess: (d) => {
      toast(d.message)
      qc.invalidateQueries({ queryKey: ['push-logs'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorBlock error={query.error} />

  return (
    <Card>
      <Table
        rows={query.data ?? []}
        empty="暂无推送目标。配置第三方 Webhook 后，实体变更将自动推送"
        columns={[
          { title: '名称', render: (t: PushTargetView) => <span className="font-medium">{t.name}</span> },
          {
            title: '端点',
            render: (t: PushTargetView) => (
              <div>
                <div className="max-w-xs truncate font-mono text-xs text-slate-500" title={t.endpointUrl}>
                  {t.httpMethod} {t.endpointUrl}
                </div>
                <div className="text-xs text-slate-400">鉴权：{t.authType}{t.hasAuthConfig ? '（已配置）' : ''}</div>
              </div>
            ),
          },
          {
            title: '触发事件',
            render: (t: PushTargetView) => (
              <div className="flex flex-wrap gap-1">
                {(t.triggerEvents ?? '').split(',').filter(Boolean).map((e) => (
                  <Badge key={e} color="blue">{e}</Badge>
                ))}
              </div>
            ),
          },
          { title: '实体范围', render: (t: PushTargetView) => t.entityScope ?? '全部' },
          {
            title: '重试',
            render: (t: PushTargetView) => <span className="text-xs">{t.retryMax} 次 / 间隔 {t.retryIntervalSeconds}s</span>,
          },
          { title: '状态', render: (t: PushTargetView) => <StatusBadge ok={t.enabled} /> },
          {
            title: '操作',
            render: (t: PushTargetView) => (
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => fullPushMut.mutate(t.id)} disabled={fullPushMut.isPending || !t.enabled}>
                  全量推送
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onEdit(t)}>编辑</Button>
                <Button size="sm" variant="danger" onClick={() => {
                  if (confirm(`确认删除推送目标「${t.name}」？`)) removeMut.mutate(t.id)
                }}>删除</Button>
              </div>
            ),
          },
        ]}
      />
    </Card>
  )
}

/* ---------------- 目标表单 ---------------- */

function TargetFormModal({ target, onClose }: { target: PushTargetView | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(target?.name ?? '')
  const [endpointUrl, setEndpointUrl] = useState(target?.endpointUrl ?? '')
  const [httpMethod, setHttpMethod] = useState(target?.httpMethod ?? 'POST')
  const [authType, setAuthType] = useState<string>(target?.authType ?? 'NONE')
  const [authConfigText, setAuthConfigText] = useState('')
  const [triggers, setTriggers] = useState<string[]>((target?.triggerEvents ?? 'ON_CREATE,ON_UPDATE,ON_DELETE').split(',').filter(Boolean))
  const [entityScope, setEntityScope] = useState(target?.entityScope ?? '')
  const [payloadTemplate, setPayloadTemplate] = useState(target?.payloadTemplate ?? '')
  const [retryMax, setRetryMax] = useState(target?.retryMax ?? 3)
  const [retryInterval, setRetryInterval] = useState(target?.retryIntervalSeconds ?? 30)
  const [enabled, setEnabled] = useState(target?.enabled ?? true)
  const [saving, setSaving] = useState(false)

  const toggleTrigger = (e: string) =>
    setTriggers((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    let authConfig: Record<string, string> | undefined
    if (authType !== 'NONE' && authConfigText.trim()) {
      try {
        authConfig = JSON.parse(authConfigText)
      } catch {
        toast('鉴权配置必须是 JSON 对象', 'error')
        return
      }
    }
    if (authType !== 'NONE' && !authConfig && !target?.hasAuthConfig) {
      toast('该鉴权方式需要配置密钥（JSON）', 'error')
      return
    }
    setSaving(true)
    try {
      const body = {
        name, endpointUrl, httpMethod, authType, authConfig,
        triggerEvents: triggers.join(','),
        entityScope: entityScope.trim() || undefined,
        payloadTemplate: payloadTemplate.trim() || undefined,
        retryMax, retryIntervalSeconds: retryInterval, enabled,
      }
      if (target) {
        await pushApi.update(target.id, body)
      } else {
        await pushApi.create(body)
      }
      toast(target ? '已更新' : '已创建')
      qc.invalidateQueries({ queryKey: ['push-targets'] })
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const authHint: Record<string, string> = {
    NONE: '不鉴权',
    BASIC: '{"username":"xxx","password":"xxx"} —— HTTP Basic 认证',
    BEARER: '{"token":"xxx"} —— 请求头 Authorization: Bearer <token>',
    HMAC_SIGNATURE: '{"secretKey":"xxx","headerName":"X-TongKey-Signature"} —— HMAC-SHA256(secretKey, timestamp + "\\n" + body)，hex 小写',
  }

  return (
    <Modal open title={target ? '编辑推送目标' : '新建推送目标'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Field label="名称" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="如：下游系统 A" />
        </Field>
        <Field label="HTTP 方法">
          <Select value={httpMethod} onChange={(e) => setHttpMethod(e.target.value)}>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="端点 URL" required>
            <TextInput value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://downstream.example.com/api/tongkey/webhook" className="font-mono !text-xs" />
          </Field>
        </div>
        <Field label="鉴权方式">
          <Select value={authType} onChange={(e) => setAuthType(e.target.value)}>
            {AUTH_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label="实体范围" hint="逗号分隔：USER,ROLE,PERMISSION；留空表示全部">
          <TextInput value={entityScope} onChange={(e) => setEntityScope(e.target.value)} placeholder="USER,ROLE" />
        </Field>
        {authType !== 'NONE' && (
          <div className="col-span-2">
            <Field label={target?.hasAuthConfig ? '鉴权配置（留空保持原密钥）' : '鉴权配置'} required={!target?.hasAuthConfig}
              hint={authHint[authType]}>
              <TextArea rows={2} value={authConfigText} onChange={(e) => setAuthConfigText(e.target.value)}
                placeholder='{"token":"..."}' />
            </Field>
          </div>
        )}
        <div className="col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">触发事件</span>
          <div className="flex flex-wrap gap-3">
            {TRIGGER_EVENTS.map((e) => (
              <label key={e} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-blue-600"
                  checked={triggers.includes(e)} onChange={() => toggleTrigger(e)} />
                {e === 'ON_INIT' ? 'ON_INIT（启用时全量初始化）' : e}
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <Field label="报文模板（可选，JSON）" hint='留空使用默认 {"eventType","entityType","entityId","action","data","timestamp"}'>
            <TextArea rows={3} value={payloadTemplate} onChange={(e) => setPayloadTemplate(e.target.value)} />
          </Field>
        </div>
        <Field label="最大重试次数">
          <TextInput type="number" value={retryMax} onChange={(e) => setRetryMax(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="重试间隔（秒）">
          <TextInput type="number" value={retryInterval} onChange={(e) => setRetryInterval(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        <Field label="状态">
          <Select value={String(enabled)} onChange={(e) => setEnabled(e.target.value === 'true')}>
            <option value="true">启用</option>
            <option value="false">停用</option>
          </Select>
        </Field>
        <div className="flex items-end justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={saving || !name || !endpointUrl || triggers.length === 0}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ================= 推送日志 ================= */

function PushLogPanel() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [targetFilter, setTargetFilter] = useState('')
  const targets = useQuery({ queryKey: ['push-targets'], queryFn: pushApi.targets })
  const query = useQuery({
    queryKey: ['push-logs', page, targetFilter],
    queryFn: () => pushApi.logs(targetFilter || undefined, page, 20),
    refetchInterval: 5000,
  })

  const retryMut = useMutation({
    mutationFn: (logId: number) => pushApi.retry(logId),
    onSuccess: () => {
      toast('已重新发起推送')
      qc.invalidateQueries({ queryKey: ['push-logs'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const statusBadge = (l: PushLog) => {
    switch (l.status) {
      case 'SUCCESS': return <Badge color="green">成功</Badge>
      case 'FAILED': return <Badge color="red">失败</Badge>
      case 'RUNNING': return <Badge color="blue">推送中</Badge>
      default: return l.retryCount > 0
        ? <Badge color="amber">等待重试（{fmtTime(l.nextRetryAt)}）</Badge>
        : <Badge color="amber">等待</Badge>
    }
  }

  return (
    <Card
      title="推送日志"
      extra={
        <div className="flex items-center gap-2">
          <Select className="!w-48" value={targetFilter} onChange={(e) => { setTargetFilter(e.target.value); setPage(0) }}>
            <option value="">全部目标</option>
            {(targets.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ['push-logs'] })}>刷新</Button>
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
              { title: '目标', render: (l: PushLog) => <span className="font-medium">{l.targetName}</span> },
              { title: '事件', render: (l: PushLog) => <Badge color="blue">{l.triggerEvent}</Badge> },
              { title: '实体', render: (l: PushLog) => <span className="text-xs">{l.entityType} / <span className="font-mono">{l.entityId.slice(0, 8)}</span></span> },
              { title: '状态', render: (l: PushLog) => statusBadge(l) },
              { title: '重试', render: (l: PushLog) => `${l.retryCount} 次` },
              { title: 'HTTP', render: (l: PushLog) => l.responseStatus ?? '-' },
              { title: '耗时', render: (l: PushLog) => (l.costMs != null ? `${l.costMs}ms` : '-') },
              { title: '时间', render: (l: PushLog) => fmtTime(l.createdAt) },
              {
                title: '操作',
                render: (l: PushLog) => l.status === 'FAILED' ? (
                  <Button size="sm" variant="danger" onClick={() => retryMut.mutate(l.id)} disabled={retryMut.isPending}>重推</Button>
                ) : (
                  <PushLogDetail log={l} />
                ),
              },
            ]}
          />
          <Pagination page={page} total={query.data?.total ?? 0} size={20} onChange={setPage} />
        </>
      )}
    </Card>
  )
}

function PushLogDetail({ log }: { log: PushLog }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>详情</Button>
      {open && (
        <Modal open title={`推送详情 #${log.id}`} onClose={() => setOpen(false)} wide>
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={() => setOpen(false)}>关闭</Button>
            </div>
            <div><span className="text-slate-400">请求：</span><span className="font-mono text-xs">{log.requestUrl}</span></div>
            {log.requestBody && (
              <div>
                <div className="mb-1 text-slate-400">请求体</div>
                <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 font-mono text-xs">{log.requestBody}</pre>
              </div>
            )}
            {log.responseBody && (
              <div>
                <div className="mb-1 text-slate-400">响应体（HTTP {log.responseStatus}）</div>
                <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 font-mono text-xs">{log.responseBody}</pre>
              </div>
            )}
            {log.errorMessage && (
              <div className="rounded bg-red-50 p-2 text-xs text-red-600">{log.errorMessage}</div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
