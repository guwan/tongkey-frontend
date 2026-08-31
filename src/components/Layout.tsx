import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { tokenStore } from '../api/client'
import { ToastHost, cls } from './ui'

const navItems = [
  { to: '/', label: '仪表盘', icon: '◈' },
  { to: '/users', label: '用户管理', icon: '👤' },
  { to: '/roles', label: '角色管理', icon: '🛡' },
  { to: '/permissions', label: '权限管理', icon: '🔑' },
  { to: '/datasources', label: '数据源与同步', icon: '⇄' },
  { to: '/push', label: '推送管理', icon: '📡' },
  { to: '/clients', label: '开放 API', icon: '⚡' },
  { to: '/audit', label: '审计日志', icon: '📋' },
  { to: '/docs', label: 'API 文档', icon: '📖' },
]

export default function Layout() {
  const navigate = useNavigate()

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      tokenStore.clear()
      navigate('/login')
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 font-bold text-white">T</div>
          <div>
            <div className="text-sm font-semibold text-white">TongKey</div>
            <div className="text-[11px] text-slate-400">开放式授权中心</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cls(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <span className="w-4 text-center text-xs">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
          v1.0.0 · 用户/角色/权限数据中心
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="text-sm text-slate-500">用户 · 角色 · 权限数据中心</div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{tokenStore.user() || 'admin'}</span>
            <button onClick={logout} className="text-slate-400 hover:text-red-600">退出登录</button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <ToastHost />
    </div>
  )
}
