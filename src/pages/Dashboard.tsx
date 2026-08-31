import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api'
import { Card, ErrorBlock, Loading } from '../components/ui'

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-slate-800">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function Rate({ value }: { value: number }) {
  const color = value >= 95 ? 'text-emerald-600' : value >= 80 ? 'text-amber-600' : 'text-red-600'
  return <span className={color}>{value}%</span>
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })

  if (isLoading) return <Loading />
  if (error) return <ErrorBlock error={error} />
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">仪表盘</h2>
        <button onClick={() => refetch()} className="text-sm text-blue-600 hover:underline">刷新</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="用户总数" value={data.domain.users}
          sub={`原生 ${data.domain.nativeUsers} · 同步 ${data.domain.syncedUsers} · API ${data.domain.apiUsers}`} />
        <Stat label="角色总数" value={data.domain.roles} />
        <Stat label="权限总数" value={data.domain.permissions} />
        <Stat label="数据源 / 映射任务" value={`${data.datasources} / ${data.syncMappings}`} sub={`推送目标 ${data.pushTargets} 个`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="近 7 天同步执行情况">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-semibold text-emerald-600">{data.sync.success7d}</div>
              <div className="mt-1 text-xs text-slate-500">成功</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-red-600">{data.sync.failed7d}</div>
              <div className="mt-1 text-xs text-slate-500">失败</div>
            </div>
            <div>
              <div className="text-xl font-semibold"><Rate value={data.sync.successRate7d} /></div>
              <div className="mt-1 text-xs text-slate-500">成功率</div>
            </div>
          </div>
          {data.sync.failed7d > 0 && (
            <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠ 近 7 天存在 {data.sync.failed7d} 次同步失败，请到「数据源与同步 → 同步日志」查看失败原因
            </div>
          )}
        </Card>

        <Card title="近 7 天推送执行情况">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xl font-semibold text-emerald-600">{data.push.success7d}</div>
              <div className="mt-1 text-xs text-slate-500">成功</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-red-600">{data.push.failed7d}</div>
              <div className="mt-1 text-xs text-slate-500">失败</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-amber-600">{data.push.pending7d}</div>
              <div className="mt-1 text-xs text-slate-500">等待重试</div>
            </div>
            <div>
              <div className="text-xl font-semibold"><Rate value={data.push.successRate7d} /></div>
              <div className="mt-1 text-xs text-slate-500">成功率</div>
            </div>
          </div>
          {data.push.failed7d > 0 && (
            <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠ 近 7 天存在 {data.push.failed7d} 次推送失败，可到「推送管理 → 推送日志」手动重推
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
