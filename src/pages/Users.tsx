import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { roleApi, userApi } from '../api'
import { fmtTime } from '../api/client'
import type { UserView } from '../api/types'
import {
  Button, Card, ErrorBlock, Field, Loading, Modal, Pagination, Select, SourceBadge,
  StatusBadge, Table, TextArea, TextInput, toast,
} from '../components/ui'

const PAGE_SIZE = 20

export default function Users() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<UserView | 'new' | null>(null)
  const [binding, setBinding] = useState<UserView | null>(null)

  const query = useQuery({
    queryKey: ['users', page, keyword, sourceType, status],
    queryFn: () => userApi.page(page, PAGE_SIZE, keyword, sourceType, status),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const removeMut = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      toast('已删除')
      invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">用户管理</h2>
        <Button onClick={() => setEditing('new')}>新建用户</Button>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <TextInput
            className="!w-64"
            placeholder="搜索用户名 / 显示名 / externalKey"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
          />
          <Select className="!w-40" value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(0) }}>
            <option value="">全部来源</option>
            <option value="NATIVE">原生</option>
            <option value="SYNCED">同步</option>
            <option value="API">API 写入</option>
          </Select>
          <Select className="!w-32" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
            <option value="">全部状态</option>
            <option value="ENABLED">启用</option>
            <option value="DISABLED">停用</option>
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
                { title: '用户名', render: (u: UserView) => <span className="font-medium">{u.username}</span> },
                { title: '显示名', render: (u: UserView) => u.displayName ?? '-' },
                { title: '来源', render: (u: UserView) => <SourceBadge sourceType={u.sourceType} /> },
                { title: '状态', render: (u: UserView) => <StatusBadge ok={u.status === 'ENABLED'} /> },
                { title: 'externalKey', render: (u: UserView) => <span className="font-mono text-xs">{u.externalKey ?? '-'}</span> },
                { title: '更新时间', render: (u: UserView) => fmtTime(u.updatedAt) },
                { title: '更新人', render: (u: UserView) => u.updatedBy ?? '-' },
                {
                  title: '操作',
                  render: (u: UserView) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setBinding(u)}>角色</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>编辑</Button>
                      <Button size="sm" variant="danger" onClick={() => {
                        if (confirm(`确认删除用户「${u.username}」？将级联删除其角色关联。`)) removeMut.mutate(u.id)
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
        <UserFormModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate() }}
        />
      )}
      {binding && <BindRoleModal user={binding} onClose={() => setBinding(null)} />}
    </div>
  )
}

function UserFormModal({ user, onClose, onSaved }: { user: UserView | null; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState(user?.username ?? '')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [status, setStatus] = useState<string>(user?.status ?? 'ENABLED')
  const [extraAttrs, setExtraAttrs] = useState(user?.extraAttrs ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const attrs = extraAttrs.trim() ? extraAttrs : undefined
      if (user) {
        await userApi.update(user.id, { displayName: displayName || undefined, status, extraAttrs: attrs })
      } else {
        await userApi.create({ username, displayName: displayName || undefined, status, extraAttrs: attrs })
      }
      toast(user ? '已更新' : '已创建')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={user ? '编辑用户' : '新建用户（原生数据）'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!user && (
          <Field label="用户名" required>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="登录账号，创建后不可修改" />
          </Field>
        )}
        <Field label="显示名">
          <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ENABLED">启用</option>
            <option value="DISABLED">停用</option>
          </Select>
        </Field>
        <Field label="扩展属性（JSON）" hint='例如 {"email":"a@b.com","dept":"研发部"}'>
          <TextArea rows={3} value={extraAttrs} onChange={(e) => setExtraAttrs(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={saving || (!user && !username)}>{saving ? '保存中…' : '保存'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function BindRoleModal({ user, onClose }: { user: UserView; onClose: () => void }) {
  const qc = useQueryClient()
  const detail = useQuery({ queryKey: ['user-detail', user.id], queryFn: () => userApi.detail(user.id) })
  const roles = useQuery({ queryKey: ['roles-all'], queryFn: () => roleApi.page(0, 200) })
  const [selected, setSelected] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['user-detail', user.id] })

  const bind = useMutation({
    mutationFn: () => userApi.bindRole(user.id, selected),
    onSuccess: () => { toast('已绑定'); setSelected(''); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const unbind = useMutation({
    mutationFn: (roleId: string) => userApi.unbindRole(user.id, roleId),
    onSuccess: () => { toast('已解绑'); invalidate() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <Modal open title={`用户「${user.username}」的角色`} onClose={onClose}>
      {detail.isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">选择角色…</option>
              {(roles.data?.items ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}（{r.code}）</option>
              ))}
            </Select>
            <Button disabled={!selected} onClick={() => bind.mutate()}>绑定</Button>
          </div>
          <div className="space-y-2">
            {(detail.data?.roles ?? []).length === 0 && <div className="py-4 text-center text-sm text-slate-400">尚未绑定角色</div>}
            {(detail.data?.roles ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <div>
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{r.code}</span>
                </div>
                <div className="flex items-center gap-3">
                  <SourceBadge sourceType={r.sourceType} />
                  <Button size="sm" variant="danger" onClick={() => unbind.mutate(r.id)}>解绑</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
