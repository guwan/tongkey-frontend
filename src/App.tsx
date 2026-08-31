import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
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
          <Route path="/docs/*" element={<Docs />} />
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
