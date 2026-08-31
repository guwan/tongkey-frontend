import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../api'
import { fmtTime } from '../api/client'
import type { AuditLog } from '../api/types'
import { Badge, Button, Card, ErrorBlock, Loading, Pagination, Select, Table } from '../components/ui'

const PAGE_SIZE = 20

const actionColor: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red' }
const actionLabel: Record<string, string> = { CREATE: '新增', UPDATE: '修改', DELETE: '删除' }

export default function Audit() {
  const [page, setPage] = useState(0)
  const [entityType, setEntityType] = useState('')
  const [days, setDays] = useState('7')

  const sinceMillis = days ? Date.now() - Number(days) * 86400_000 : undefined

  const query = useQuery({
    queryKey: ['audit', page, entityType, days],
    queryFn: () => auditApi.page(page, PAGE_SIZE, entityType || undefined, sinceMillis),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">审计日志</h2>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select className="!w-40" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0) }}>
            <option value="">全部实体类型</option>
            <option value="USER">用户</option>
            <option value="ROLE">角色</option>
            <option value="PERMISSION">权限</option>
            <option value="USER_ROLE">用户-角色关联</option>
            <option value="ROLE_PERMISSION">角色-权限关联</option>
          </Select>
          <Select className="!w-36" value={days} onChange={(e) => { setDays(e.target.value); setPage(0) }}>
            <option value="1">近 1 天</option>
            <option value="7">近 7 天</option>
            <option value="30">近 30 天</option>
            <option value="">全部时间</option>
          </Select>
          <Button size="sm" variant="secondary" onClick={() => query.refetch()}>刷新</Button>
          <span className="ml-auto text-xs text-slate-400">记录谁、何时、通过什么渠道（控制台/同步/开放API）、改了什么</span>
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
                { title: '时间', render: (l: AuditLog) => <span className="whitespace-nowrap text-xs">{fmtTime(l.createdAt)}</span> },
                {
                  title: '渠道',
                  render: (l: AuditLog) => {
                    const ch = l.channel
                    const color = ch === 'CONSOLE' ? 'blue' : ch.startsWith('SYNC') ? 'purple' : ch.startsWith('API') ? 'amber' : 'slate'
                    return <Badge color={color}>{ch}</Badge>
                  },
                },
                { title: '操作者', render: (l: AuditLog) => <span className="text-xs">{l.operator || '-'}</span> },
                { title: '实体', render: (l: AuditLog) => <span className="text-xs">{l.entityType}</span> },
                { title: '标识', render: (l: AuditLog) => <span className="font-mono text-xs">{l.entityCode ?? l.entityId.slice(0, 8)}</span> },
                {
                  title: '动作',
                  render: (l: AuditLog) => <Badge color={actionColor[l.action] ?? 'slate'}>{actionLabel[l.action] ?? l.action}</Badge>,
                },
                {
                  title: '详情',
                  render: (l: AuditLog) => l.detail
                    ? <span className="block max-w-md truncate text-xs text-slate-500" title={l.detail}>{l.detail}</span>
                    : '-',
                },
              ]}
            />
            <Pagination page={page} total={query.data?.total ?? 0} size={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
