import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { tokenStore } from '../api/client'
import { Button, Field, TextInput, ToastHost, toast } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.login(username, password)
      tokenStore.set(data.token, data.username)
      navigate('/')
    } catch (err) {
      toast(err instanceof Error ? err.message : '登录失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <form onSubmit={submit} className="w-96 rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-xl font-bold text-white">T</div>
          <h1 className="text-lg font-semibold text-slate-800">TongKey 开放式授权中心</h1>
          <p className="mt-1 text-xs text-slate-400">用户 · 角色 · 权限数据中心管理控制台</p>
        </div>
        <div className="space-y-4">
          <Field label="用户名" required>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus />
          </Field>
          <Field label="密码" required>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </Field>
          <Button type="submit" disabled={loading || !username || !password}>
            {loading ? '登录中…' : '登 录'}
          </Button>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">初始账号见部署文档（默认 admin / Admin@123）</p>
      </form>
      <ToastHost />
    </div>
  )
}
