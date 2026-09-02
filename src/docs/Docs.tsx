import { NavLink, Route, Routes } from 'react-router-dom'
import QuickStart from './QuickStart'
import DataDictionary from './DataDictionary'
import OpenApi from './OpenApi'
import WebhookSpec from './WebhookSpec'
import Changelog from './Changelog'
import { cls } from '../components/ui'

const sections = [
  { to: '/docs', label: '快速开始（Quick Start）', end: true },
  { to: '/docs/openapi', label: '开放 API 参考（更新/查询）' },
  { to: '/docs/dictionary', label: '数据模型字典' },
  { to: '/docs/webhook', label: 'Webhook 接收端规范' },
  { to: '/docs/changelog', label: '变更日志（Changelog）' },
]

export default function Docs() {
  return (
    <div className="flex gap-6">
      <aside className="w-60 shrink-0">
        <div className="sticky top-0 space-y-1">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">API 文档</h2>
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cls(
                  'block rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-200/60',
                )
              }
            >
              {s.label}
            </NavLink>
          ))}
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
            <a href="/swagger-ui.html" target="_blank" rel="noreferrer"
              className="block rounded-md bg-slate-900 px-3 py-2 text-center text-sm text-white hover:bg-slate-700">
              Swagger UI 交互调试 ↗
            </a>
            <a href="/v3/api-docs" target="_blank" rel="noreferrer"
              className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
              下载 OpenAPI JSON ↗
            </a>
            <p className="px-1 text-[11px] leading-relaxed text-slate-400">
              OpenAPI 3.0 JSON 可直接导入 Postman 或用于 SDK 代码生成（面向人类与 AI 读者）。
            </p>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <Routes>
          <Route index element={<QuickStart />} />
          <Route path="openapi" element={<OpenApi />} />
          <Route path="dictionary" element={<DataDictionary />} />
          <Route path="webhook" element={<WebhookSpec />} />
          <Route path="changelog" element={<Changelog />} />
        </Routes>
      </div>
    </div>
  )
}

/** 文档区块通用容器 */
export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-3 text-base font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  )
}

/** 代码块 */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="relative">
      {lang && <span className="absolute right-2 top-2 text-[10px] uppercase text-slate-500">{lang}</span>}
      <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{code}</pre>
    </div>
  )
}

/** 内联代码 */
export function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-rose-600">{children}</code>
}

/** 简单表格 */
export function DocTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            {headers.map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
