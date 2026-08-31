import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { permissionApi, roleApi } from '../api'
import { fmtTime } from '../api/client'
import type { RoleView } from '../api/types'
import {
  Button, Card, ErrorBlock, Field, Loading, Modal, Pagination, Select, SourceBadge,
  Table, TextArea, TextInput, toast,
} from '../components/ui'

const PAGE_SIZE = 20

export default function Roles() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [editing, setEditing] = useState<RoleView | 'new' | null>(null)
  const [binding, setBinding] = useState<RoleView | null>(null)

  const query = useQuery({
    queryKey: ['roles', page, keyword, sourceType],
    queryFn: () => roleApi.page(page, PAGE_SIZE, keyword, sourceType),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['roles'] })

  const removeMut = useMutation({
    mutationFn: (id: string) => roleApi.remove(id),
    onSuccess: () => { toast('已删除'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">角色管理</h2>
        <Button onClick={() => setEditing('new')}>新建角色</Button>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <TextInput
            className="!w-64"
            placeholder="搜索角色编码 / 名称"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
          />
          <Select className="!w-40" value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(0) }}>
            <option value="">全部来源</option>
            <option value="NATIVE">原生</option>
            <option value="SYNCED">同步</option>
            <option value="API">API 写入</option>
          </Select>
        </div>

        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorBlock error={query.error} />
        ) : (
          <>
            <Table
              rows={query.data?.items ?? []}
              columns={[
                { title: '编码', render: (r: RoleView) => <span className="font-mono text-xs font-medium">{r.code}</span> },
                { title: '名称', render: (r: RoleView) => r.name },
                { title: '描述', render: (r: RoleView) => <span className="text-slate-500">{r.description ?? '-'}</span> },
                { title: '来源', render: (r: RoleView) => <SourceBadge sourceType={r.sourceType} /> },
                { title: '更新时间', render: (r: RoleView) => fmtTime(r.updatedAt) },
                {
                  title: '操作',
                  render: (r: RoleView) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setBinding(r)}>权限</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>编辑</Button>
                      <Button size="sm" variant="danger" onClick={() => {
                        if (confirm(`确认删除角色「${r.name}」？将级联删除其用户/权限关联。`)) removeMut.mutate(r.id)
                      }}>删除</Button>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} total={query.data?.total ?? 0} size={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </Card>

      {editing && (
        <RoleFormModal
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate() }}
        />
      )}
      {binding && <BindPermissionModal role={binding} onClose={() => setBinding(null)} />}
    </div>
  )
}

function RoleFormModal({ role, onClose, onSaved }: { role: RoleView | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(role?.code ?? '')
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [extraAttrs, setExtraAttrs] = useState(role?.extraAttrs ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const attrs = extraAttrs.trim() ? extraAttrs : undefined
      if (role) {
        await roleApi.update(role.id, { name, description: description || undefined, extraAttrs: attrs })
      } else {
        await roleApi.create({ code, name, description: description || undefined, extraAttrs: attrs })
      }
      toast(role ? '已更新' : '已创建')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={role ? '编辑角色' : '新建角色'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!role && (
          <Field label="角色编码" required>
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="如 ROLE_ADMIN，创建后不可修改" />
          </Field>
        )}
        <Field label="角色名称" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="描述">
          <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="扩展属性（JSON）">
          <TextArea rows={3} value={extraAttrs} onChange={(e) => setExtraAttrs(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={saving || !name || (!role && !code)}>{saving ? '保存中…' : '保存'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function BindPermissionModal({ role, onClose }: { role: RoleView; onClose: () => void }) {
  const qc = useQueryClient()
  const detail = useQuery({ queryKey: ['role-detail', role.id], queryFn: () => roleApi.detail(role.id) })
  const permissions = useQuery({ queryKey: ['permissions-all'], queryFn: () => permissionApi.page(0, 500) })
  const [selected, setSelected] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['role-detail', role.id] })

  const bind = useMutation({
    mutationFn: () => roleApi.bindPermission(role.id, selected),
    onSuccess: () => { toast('已授权'); setSelected(''); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const unbind = useMutation({
    mutationFn: (permissionId: string) => roleApi.unbindPermission(role.id, permissionId),
    onSuccess: () => { toast('已回收'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <Modal open title={`角色「${role.name}」的权限`} onClose={onClose}>
      {detail.isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">选择权限…</option>
              {(permissions.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}（{p.code}）</option>
              ))}
            </Select>
            <Button disabled={!selected} onClick={() => bind.mutate()}>授权</Button>
          </div>
          <div className="space-y-2">
            {(detail.data?.permissions ?? []).length === 0 && <div className="py-4 text-center text-sm text-slate-400">尚未分配权限</div>}
            {(detail.data?.permissions ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <div>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{p.code}</span>
                  <span className="ml-2 text-xs text-slate-400">{p.resourceType}</span>
                </div>
                <Button size="sm" variant="danger" onClick={() => unbind.mutate(p.id)}>回收</Button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
