import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { permissionApi } from '../api'
import { fmtTime } from '../api/client'
import type { PermissionView } from '../api/types'
import {
  Badge, Button, Card, ErrorBlock, Field, Loading, Modal, Pagination, Select, SourceBadge,
  Table, TextArea, TextInput, toast,
} from '../components/ui'

const PAGE_SIZE = 20
const RESOURCE_TYPES = ['MENU', 'BUTTON', 'API', 'DATA', 'OTHER']

const resourceColor: Record<string, string> = {
  MENU: 'blue', BUTTON: 'purple', API: 'amber', DATA: 'green', OTHER: 'slate',
}

export default function Permissions() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [editing, setEditing] = useState<PermissionView | 'new' | null>(null)

  const query = useQuery({
    queryKey: ['permissions', page, keyword, sourceType, resourceType],
    queryFn: () => permissionApi.page(page, PAGE_SIZE, keyword, sourceType, resourceType),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['permissions'] })

  const removeMut = useMutation({
    mutationFn: (id: string) => permissionApi.remove(id),
    onSuccess: () => { toast('已删除'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">权限管理</h2>
        <Button onClick={() => setEditing('new')}>新建权限</Button>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <TextInput
            className="!w-64"
            placeholder="搜索权限编码 / 名称"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
          />
          <Select className="!w-40" value={resourceType} onChange={(e) => { setResourceType(e.target.value); setPage(0) }}>
            <option value="">全部资源类型</option>
            {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
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
                { title: '编码', render: (p: PermissionView) => <span className="font-mono text-xs font-medium">{p.code}</span> },
                { title: '名称', render: (p: PermissionView) => p.name },
                {
                  title: '资源类型',
                  render: (p: PermissionView) => <Badge color={resourceColor[p.resourceType] ?? 'slate'}>{p.resourceType}</Badge>,
                },
                { title: '描述', render: (p: PermissionView) => <span className="text-slate-500">{p.description ?? '-'}</span> },
                { title: '来源', render: (p: PermissionView) => <SourceBadge sourceType={p.sourceType} /> },
                { title: '更新时间', render: (p: PermissionView) => fmtTime(p.updatedAt) },
                {
                  title: '操作',
                  render: (p: PermissionView) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>编辑</Button>
                      <Button size="sm" variant="danger" onClick={() => {
                        if (confirm(`确认删除权限「${p.name}」？将级联删除角色关联。`)) removeMut.mutate(p.id)
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
        <PermissionFormModal
          perm={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate() }}
        />
      )}
    </div>
  )
}

function PermissionFormModal({ perm, onClose, onSaved }: {
  perm: PermissionView | null; onClose: () => void; onSaved: () => void
}) {
  const [code, setCode] = useState(perm?.code ?? '')
  const [name, setName] = useState(perm?.name ?? '')
  const [description, setDescription] = useState(perm?.description ?? '')
  const [resourceType, setResourceType] = useState<string>(perm?.resourceType ?? 'MENU')
  const [extraAttrs, setExtraAttrs] = useState(perm?.extraAttrs ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const attrs = extraAttrs.trim() ? extraAttrs : undefined
      if (perm) {
        await permissionApi.update(perm.id, { name, description: description || undefined, resourceType, extraAttrs: attrs })
      } else {
        await permissionApi.create({ code, name, description: description || undefined, resourceType, extraAttrs: attrs })
      }
      toast(perm ? '已更新' : '已创建')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={perm ? '编辑权限' : '新建权限'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!perm && (
          <Field label="权限编码" required>
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="如 user:create，创建后不可修改" />
          </Field>
        )}
        <Field label="权限名称" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="资源类型">
          <Select value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
            {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="描述">
          <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="扩展属性（JSON）">
          <TextArea rows={3} value={extraAttrs} onChange={(e) => setExtraAttrs(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={saving || !name || (!perm && !code)}>{saving ? '保存中…' : '保存'}</Button>
        </div>
      </form>
    </Modal>
  )
}
