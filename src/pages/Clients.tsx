import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientApi } from '../api'
import { fmtTime } from '../api/client'
import type { ApiAccessLog, ClientView } from '../api/types'
import {
  Badge, Button, Card, Checkbox, copyToClipboard, ErrorBlock, Field, Loading, Modal, Pagination, Select,
  StatusBadge, Table, TextInput, cls, toast,
} from '../components/ui'

const SCOPE_OPTIONS = [
  'user:read', 'user:write',
  'role:read', 'role:write',
  'permission:read', 'permission:write',
  'user_role:write', 'role_permission:write',
  'change:read',
]

export default function Clients() {
  const [tab, setTab] = useState<'clients' | 'logs'>('clients')
  const [editing, setEditing] = useState<ClientView | 'new' | null>(null)
  const [secretModal, setSecretModal] = useState<{ clientId: string; apiKey: string; clientSecret: string } | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">开放 API 管理</h2>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
            {(['clients', 'logs'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cls('rounded px-3 py-1.5 text-sm', tab === t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                {t === 'clients' ? '接入方 / API Key' : '调用日志'}
              </button>
            ))}
          </div>
          {tab === 'clients' && <Button onClick={() => setEditing('new')}>新建接入方</Button>}
        </div>
      </div>

      {tab === 'clients'
        ? <ClientList onEdit={setEditing} onSecret={setSecretModal} />
        : <AccessLogPanel />}

      {editing && (
        <ClientFormModal
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(d) => {
            setEditing(null)
            setSecretModal({ clientId: d.client.clientId, apiKey: d.client.apiKey, clientSecret: d.clientSecret })
          }}
        />
      )}

      {secretModal && <SecretModal data={secretModal} onClose={() => setSecretModal(null)} />}
    </div>
  )
}

/* ================= 接入方列表 ================= */

function ClientList({ onEdit, onSecret }: {
  onEdit: (c: ClientView) => void
  onSecret: (d: { clientId: string; apiKey: string; clientSecret: string }) => void
}) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['clients'], queryFn: clientApi.list })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['clients'] })

  const removeMut = useMutation({
    mutationFn: (id: string) => clientApi.remove(id),
    onSuccess: () => { toast('已删除，其 API Key 立即失效'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const resetMut = useMutation({
    mutationFn: (id: string) => clientApi.resetKey(id),
    onSuccess: (d) => {
      toast('API Key 已重置，旧 Key 立即失效')
      onSecret({ clientId: d.clientId, apiKey: d.apiKey, clientSecret: '' })
      invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorBlock error={query.error} />

  return (
    <Card>
      <Table
        rows={query.data ?? []}
        empty="暂无接入方。创建后第三方系统即可通过 X-API-Key 调用开放 API"
        columns={[
          { title: 'client_id', render: (c: ClientView) => <span className="font-mono text-xs font-medium">{c.clientId}</span> },
          { title: '名称', render: (c: ClientView) => c.name },
          {
            title: 'API Key',
            render: (c: ClientView) => (
              <button
                className="font-mono text-xs text-blue-600 hover:underline"
                title="点击复制"
                onClick={async () => { await copyToClipboard(c.apiKey); toast('已复制 API Key') }}
              >
                {c.apiKey.slice(0, 12)}…
              </button>
            ),
          },
          {
            title: '权限（scopes）',
            render: (c: ClientView) => (
              <div className="flex max-w-xs flex-wrap gap-1">
                {c.scopes.split(',').filter(Boolean).map((s) => <Badge key={s} color="blue">{s}</Badge>)}
              </div>
            ),
          },
          { title: '限流', render: (c: ClientView) => `${c.qpsLimit} QPS` },
          { title: '签名', render: (c: ClientView) => c.requireSignature ? <Badge color="amber">必须</Badge> : <Badge>可选</Badge> },
          { title: '状态', render: (c: ClientView) => <StatusBadge ok={c.enabled} /> },
          {
            title: '操作',
            render: (c: ClientView) => (
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => {
                  if (confirm('重置后旧 API Key 立即失效，确认继续？')) resetMut.mutate(c.id)
                }}>重置 Key</Button>
                <Button size="sm" variant="secondary" onClick={() => onEdit(c)}>编辑</Button>
                <Button size="sm" variant="danger" onClick={() => {
                  if (confirm(`确认删除接入方「${c.name}」？`)) removeMut.mutate(c.id)
                }}>删除</Button>
              </div>
            ),
          },
        ]}
      />
    </Card>
  )
}

/* ---------------- 接入方表单 ---------------- */

function ClientFormModal({ client, onClose, onCreated }: {
  client: ClientView | null
  onClose: () => void
  onCreated: (d: { client: ClientView; clientSecret: string }) => void
}) {
  const qc = useQueryClient()
  const [clientId, setClientId] = useState(client?.clientId ?? '')
  const [name, setName] = useState(client?.name ?? '')
  const [scopes, setScopes] = useState<string[]>(client ? client.scopes.split(',').filter(Boolean) : ['user:read'])
  const [qpsLimit, setQpsLimit] = useState(client?.qpsLimit ?? 50)
  const [requireSignature, setRequireSignature] = useState(client?.requireSignature ?? false)
  const [enabled, setEnabled] = useState(client?.enabled ?? true)
  const [saving, setSaving] = useState(false)

  const toggleScope = (s: string) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { clientId, name, scopes: scopes.join(','), qpsLimit, requireSignature, enabled }
      if (client) {
        await clientApi.update(client.id, body)
        toast('已更新')
        qc.invalidateQueries({ queryKey: ['clients'] })
        onClose()
      } else {
        const d = await clientApi.create(body)
        toast('已创建')
        qc.invalidateQueries({ queryKey: ['clients'] })
        onCreated(d)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={client ? '编辑接入方' : '新建接入方'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="client_id" required hint="创建后不可修改，如 oa-system">
            <TextInput value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={!!client} className="font-mono !text-xs" />
          </Field>
          <Field label="名称" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="如：OA 办公系统" />
          </Field>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">
            接口权限（scopes）<span className="ml-1 text-xs font-normal text-slate-400">按需最小化授权</span>
          </span>
          <div className="grid grid-cols-4 gap-2">
            {SCOPE_OPTIONS.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 font-mono text-xs hover:bg-slate-50">
                <input type="checkbox" className="h-3.5 w-3.5 accent-blue-600" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 items-end gap-4">
          <Field label="限流（QPS）">
            <TextInput type="number" value={qpsLimit} onChange={(e) => setQpsLimit(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <div className="pb-2">
            <Checkbox checked={requireSignature} onChange={setRequireSignature} label="强制签名校验（防重放）" />
          </div>
          <Field label="状态">
            <Select value={String(enabled)} onChange={(e) => setEnabled(e.target.value === 'true')}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={saving || !clientId || !name || scopes.length === 0}>
            {saving ? '保存中…' : client ? '保存' : '创建（生成 API Key）'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------- 凭证展示 ---------------- */

function SecretModal({ data, onClose }: {
  data: { clientId: string; apiKey: string; clientSecret: string }
  onClose: () => void
}) {
  const copy = async (text: string, label: string) => {
    await copyToClipboard(text)
    toast(`已复制 ${label}`)
  }

  // 结构化 JSON 复制：包含 base URL + 完整凭证，方便对接方一键使用
  const copyAll = async () => {
    const payload: Record<string, string> = {
      client_id: data.clientId,
      api_key: data.apiKey,
    }
    if (data.clientSecret) payload.client_secret = data.clientSecret
    payload.base_url = `${window.location.origin}/api`
    const text = JSON.stringify(payload, null, 2)
    await copyToClipboard(text)
    toast('已复制全部凭证（JSON 格式）')
  }

  return (
    <Modal open title="接入凭证" onClose={onClose}>
      <div className="space-y-3">
        {data.clientSecret && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Client Secret 仅本次显示，请立即保存。签名校验（防重放）需使用该密钥。
          </div>
        )}
        <div className="space-y-2">
          <CredRow label="client_id" value={data.clientId} onCopy={() => copy(data.clientId, 'client_id')} />
          <CredRow label="API Key" value={data.apiKey} onCopy={() => copy(data.apiKey, 'API Key')} />
          {data.clientSecret && (
            <CredRow label="Client Secret" value={data.clientSecret} onCopy={() => copy(data.clientSecret, 'Client Secret')} />
          )}
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={copyAll}>复制全部（JSON）</Button>
          <Button onClick={onClose}>我已保存</Button>
        </div>
      </div>
    </Modal>
  )
}

function CredRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="truncate font-mono text-sm">{value}</div>
      </div>
      <Button size="sm" variant="secondary" onClick={onCopy}>复制</Button>
    </div>
  )
}

/* ================= 调用日志 ================= */

function AccessLogPanel() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [clientFilter, setClientFilter] = useState('')
  const clients = useQuery({ queryKey: ['clients'], queryFn: clientApi.list })
  const query = useQuery({
    queryKey: ['access-logs', page, clientFilter],
    queryFn: () => clientApi.accessLogs(clientFilter || undefined, page, 20),
    refetchInterval: 10000,
  })

  return (
    <Card
      title="开放 API 调用日志"
      extra={
        <div className="flex items-center gap-2">
          <Select className="!w-48" value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); setPage(0) }}>
            <option value="">全部接入方</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.clientId}>{c.name}</option>)}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ['access-logs'] })}>刷新</Button>
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
              { title: '接入方', render: (l: ApiAccessLog) => <span className="font-mono text-xs font-medium">{l.clientId}</span> },
              {
                title: '请求',
                render: (l: ApiAccessLog) => (
                  <div className="max-w-sm">
                    <span className="font-mono text-xs">{l.method} {l.path}</span>
                    {l.paramSummary && <div className="truncate font-mono text-[11px] text-slate-400" title={l.paramSummary}>{l.paramSummary}</div>}
                  </div>
                ),
              },
              {
                title: 'HTTP',
                render: (l: ApiAccessLog) => (
                  <Badge color={l.httpStatus < 400 ? 'green' : l.httpStatus === 429 ? 'amber' : 'red'}>{l.httpStatus}</Badge>
                ),
              },
              { title: '耗时', render: (l: ApiAccessLog) => `${l.costMs}ms` },
              { title: '来源 IP', render: (l: ApiAccessLog) => <span className="font-mono text-xs">{l.remoteIp ?? '-'}</span> },
              { title: '时间', render: (l: ApiAccessLog) => fmtTime(l.createdAt) },
            ]}
          />
          <Pagination page={page} total={query.data?.total ?? 0} size={20} onChange={setPage} />
        </>
      )}
    </Card>
  )
}
