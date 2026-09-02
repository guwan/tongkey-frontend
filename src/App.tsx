import { useEffect } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import { setUnauthorizedHandler, tokenStore } from './api/client'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Roles from './pages/Roles'
import Permissions from './pages/Permissions'
import DataSources from './pages/DataSources'
import Push from './pages/Push'
import Clients from './pages/Clients'
import Audit from './pages/Audit'
import Docs from './docs/Docs'

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    setUnauthorizedHandler(() => navigate('/login'))
  }, [navigate])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* 公开路由：API 文档（无需登录，面向外部系统对接方） */}
      <Route path="/docs/*" element={<PublicDocsLayout />} />

      {/* 内部路由：全部需要登录 */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/datasources" element={<DataSources />} />
          <Route path="/push" element={<Push />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RequireAuth() {
  if (!tokenStore.get()) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

/** 公开文档页布局：极简，面向外部对接方；顶部只留 TongKey logo 和可选的登录入口 */
function PublicDocsLayout() {
  const isLoggedIn = !!tokenStore.get()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <Link to="/docs" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 font-bold text-white">T</div>
          <div>
            <span className="text-sm font-semibold text-slate-800">TongKey</span>
            <span className="ml-2 text-xs text-slate-400">开放式授权中心 · API 文档</span>
          </div>
        </Link>
        {isLoggedIn ? (
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-slate-500 hover:text-blue-600">← 返回控制台</Link>
          </div>
        ) : (
          <Link to="/login" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
            管理控制台登录 →
          </Link>
        )}
      </header>
      <main className="mx-auto max-w-7xl p-6">
        <Docs />
      </main>
    </div>
  )
}
