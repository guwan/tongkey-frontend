import { forwardRef, useEffect, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

/** 跨环境剪贴板（优先 navigator.clipboard，HTTP + LAN IP 下回退到 execCommand）。 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 继续走 fallback */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/* ---------------- 按钮 ---------------- */
export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled, size = 'md', title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  type?: 'button' | 'submit'
  disabled?: boolean
  size?: 'sm' | 'md'
  title?: string
}) {
  const styles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700',
    danger: 'bg-white border border-red-300 hover:bg-red-50 text-red-600',
    ghost: 'hover:bg-slate-100 text-slate-600',
  }[variant]
  const sz = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cls('rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed', styles, sz)}
    >
      {children}
    </button>
  )
}

/* ---------------- 表单控件 ---------------- */
const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white'

export function Field({ label, required, error, children, hint, className }: {
  label: ReactNode; required?: boolean; error?: string; children: ReactNode; hint?: string; className?: string
}) {
  return (
    <div className={cls('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} className={cls(inputCls, props.className)} />
)
TextInput.displayName = 'TextInput'

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea ref={ref} {...props} className={cls(inputCls, props.className)} />
)
TextArea.displayName = 'TextArea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  (props, ref) => <select ref={ref} {...props} className={cls(inputCls, props.className)} />
)
Select.displayName = 'Select'

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-blue-600" />
      {label}
    </label>
  )
}

/* ---------------- 徽章 ---------------- */
export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return <span className={cls('inline-block rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', map[color] ?? map.slate)}>{children}</span>
}

/** 来源标记：原生 / 同步 / API 写入（规格文档 9） */
export function SourceBadge({ sourceType }: { sourceType: string }) {
  const map: Record<string, [string, string]> = {
    NATIVE: ['原生', 'blue'],
    SYNCED: ['同步', 'purple'],
    API: ['API写入', 'amber'],
  }
  const [text, color] = map[sourceType] ?? [sourceType, 'slate']
  return <Badge color={color}>{text}</Badge>
}

export function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? <Badge color="green">启用</Badge> : <Badge color="slate">停用</Badge>
}

/* ---------------- 卡片与表格 ---------------- */
export function Card({ title, extra, children }: { title?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {(title || extra) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {extra}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

export function Table({ columns, rows, empty }: {
  columns: Array<{ title: string; render: (row: never) => ReactNode; width?: string }>
  rows: unknown[]
  empty?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            {columns.map((c) => (
              <th key={c.title} className="px-3 py-2 font-medium whitespace-nowrap" style={c.width ? { width: c.width } : undefined}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                {empty ?? '暂无数据'}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.title} className="px-3 py-2 align-top">
                  {c.render(r as never)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ page, total, size, onChange, onSizeChange, pageSizeOptions }: {
  page: number; total: number; size: number; onChange: (page: number) => void
  onSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(0, page), pages - 1)
  const [jump, setJump] = useState('')
  const options = pageSizeOptions ?? [10, 20, 50, 100]

  const go = (p: number) => onChange(Math.min(Math.max(0, p), pages - 1))
  const doJump = () => {
    const n = Number(jump)
    if (Number.isInteger(n) && n >= 1) go(n - 1)
    setJump('')
  }

  // 页码序列：始终含首页/末页，当前页前后各 2 页，其余折叠为 …
  const seq: Array<number | '…'> = []
  const add = (p: number) => seq.push(p)
  if (pages <= 7) {
    for (let i = 0; i < pages; i++) add(i)
  } else {
    add(0)
    const from = Math.max(1, current - 2)
    const to = Math.min(pages - 2, current + 2)
    if (from > 1) seq.push('…')
    for (let i = from; i <= to; i++) add(i)
    if (to < pages - 2) seq.push('…')
    add(pages - 1)
  }

  const navBtn = 'min-w-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3 text-sm text-slate-500">
      <span>共 {total} 条</span>
      <div className="flex flex-wrap items-center gap-2">
        <button className={navBtn} disabled={current <= 0} onClick={() => go(0)} title="首页">«</button>
        <button className={navBtn} disabled={current <= 0} onClick={() => go(current - 1)} title="上一页">上一页</button>
        {seq.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              className={cls(
                'min-w-8 rounded border px-2 py-1 text-xs',
                p === current
                  ? 'border-blue-600 bg-blue-600 font-medium text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {p + 1}
            </button>
          ),
        )}
        <button className={navBtn} disabled={current >= pages - 1} onClick={() => go(current + 1)} title="下一页">下一页</button>
        <button className={navBtn} disabled={current >= pages - 1} onClick={() => go(pages - 1)} title="末页">»</button>
        <span className="ml-1 text-xs">{current + 1} / {pages} 页</span>
        <span className="flex items-center gap-1 text-xs">
          跳至
          <input
            className="w-12 rounded border border-slate-300 px-1.5 py-1 text-center text-xs"
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && doJump()}
            placeholder={String(current + 1)}
          />
          页
          <button className={navBtn} onClick={doJump}>Go</button>
        </span>
        {onSizeChange && (
          <select
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700"
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            title="每页条数"
          >
            {options.map((s) => <option key={s} value={s}>{s} 条/页</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

/* ---------------- 弹窗 ---------------- */
export function Modal({ open, title, onClose, children, wide }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6" onMouseDown={onClose}>
      <div
        className={cls('mt-8 w-full rounded-lg bg-white shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ---------------- 轻提示 ---------------- */
type ToastItem = { id: number; text: string; kind: 'success' | 'error' }
let toastListeners: Array<(t: ToastItem) => void> = []
let toastSeq = 0

export function toast(text: string, kind: 'success' | 'error' = 'success') {
  toastListeners.forEach((fn) => fn({ id: ++toastSeq, text, kind }))
}

export function ToastHost() {
  return <ToastHostInner />
}

function ToastHostInner() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    const fn = (t: ToastItem) => {
      setItems((prev) => [...prev, t])
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3500)
    }
    toastListeners.push(fn)
    return () => {
      toastListeners = toastListeners.filter((x) => x !== fn)
    }
  }, [])
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cls(
            'pointer-events-auto max-w-sm rounded-md px-4 py-2.5 text-sm text-white shadow-lg',
            t.kind === 'success' ? 'bg-emerald-600' : 'bg-red-600',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

/* ---------------- 加载与错误提示 ---------------- */
export function Loading() {
  return <div className="py-10 text-center text-sm text-slate-400">加载中…</div>
}

export function ErrorBlock({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error)
  return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{msg}</div>
}
