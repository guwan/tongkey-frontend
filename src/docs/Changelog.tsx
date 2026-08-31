import { Badge } from '../components/ui'
import { DocSection } from './Docs'

const entries = [
  {
    version: 'v1.0.0',
    date: '2026-08-28',
    tag: 'GA' as const,
    items: [
      '首发版本：用户/角色/权限核心域模型与管理控制台完整 CRUD',
      '第三方数据源接入：MySQL / Oracle / PostgreSQL / MariaDB / SQL Server 五种，连接测试、密码加密存储',
      '同步引擎：全量 + 增量（水位/占位符）、冲突策略（同步覆盖/原生优先/跳过）、Cron 调度、SQL 在线调试预览',
      '推送引擎：初始化全量推送、增量事件推送、重试与手动重推、报文模板',
      '开放 REST API v1：API Key 鉴权、scope 权限、QPS 限流、HMAC 签名防重放、全量访问日志',
      '变更查询接口 /api/v1/changes（增量拉取）',
      '增强文档站点：Quick Start、数据模型字典（可导出 JSON）、Webhook 接收端规范',
      '审计：全部写操作记录渠道（控制台/同步/开放API）与操作者',
    ],
  },
]

export default function Changelog() {
  return (
    <div>
      <DocSection title="变更日志（Changelog）">
        <p className="mb-4 text-sm text-slate-600">
          接口版本变更记录。发生破坏性变更（Breaking Change）时将在此显著标注，请第三方接入方关注。
        </p>
        <div className="space-y-6">
          {entries.map((e) => (
            <div key={e.version} className="rounded-lg border border-slate-200 p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-base font-semibold text-slate-800">{e.version}</span>
                <Badge color="green">{e.tag}</Badge>
                <span className="text-sm text-slate-400">{e.date}</span>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                {e.items.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  )
}
