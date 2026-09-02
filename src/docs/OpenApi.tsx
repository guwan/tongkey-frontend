import { Code, CodeBlock, DocSection, DocTable } from './Docs'

const BASE = 'http://localhost:8080'
const API_KEY = 'tk_your_api_key_here'

/** 端点头部小标签 */
function Endpoint({ method, path, scope, desc }: { method: string; path: string; scope?: string; desc?: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-rose-100 text-rose-700',
  }
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
      <span className={`rounded px-2 py-0.5 text-xs font-bold ${colors[method] ?? 'bg-slate-100 text-slate-700'}`}>{method}</span>
      <Code>{path}</Code>
      {scope && <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">scope: {scope}</span>}
      {desc && <span className="text-xs text-slate-500">{desc}</span>}
    </div>
  )
}

/** curl 示例 */
function Curl({ curl }: { curl: string }) {
  return <CodeBlock lang="bash" code={curl.replace(/YOUR_API_KEY/g, API_KEY)} />
}

/** JSON 示例 */
function Json({ json, title }: { json: string; title?: string }) {
  return (
    <div className="mb-4">
      {title && <div className="mb-1 text-xs font-medium text-slate-500">{title}</div>}
      <CodeBlock lang="json" code={json} />
    </div>
  )
}

export default function OpenApi() {
  return (
    <div>
      {/* ========= 概述 ========= */}
      <DocSection title="概述">
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          TongKey 对外 REST API 位于 <Code>/api/v1/**</Code>，供第三方身份系统（如 HIS、OA、ERP）对接。
          所有请求需携带 <Code>X-API-Key</Code> 请求头。数据以 JSON 传输，时间字段为 epoch 毫秒。
        </p>
        <DocTable
          headers={['基础地址', '值']}
          rows={[
            ['开发环境', <Code>{BASE}</Code>],
            ['API 根路径', <Code>/api/v1</Code>],
            ['鉴权方式', <><Code>X-API-Key</Code> 请求头，可选 HMAC-SHA256 签名防重放</>],
            ['数据格式', 'application/json（UTF-8）'],
            ['时间格式', 'epoch 毫秒（UTC）'],
          ]}
        />
      </DocSection>

      {/* ========= 鉴权 ========= */}
      <DocSection title="鉴权">
        <p className="mb-3 text-sm text-slate-600">
          1. 在管理控制台「开放 API」页创建接入方，获取 <Code>apiKey</Code>（以 <Code>tk_</Code> 开头）
          和 <Code>clientSecret</Code>（仅创建时显示一次）。<br />
          2. 每次请求携带 <Code>X-API-Key: tk_xxx</Code> 请求头。<br />
          3. 如果接入方开启了 <Code>requireSignature=true</Code>，还需额外计算签名并附加到请求头。
        </p>
        <DocTable
          headers={['请求头', '说明', '是否必填']}
          rows={[
            [<Code>X-API-Key</Code>, '接入方的 apiKey', '✅ 必填'],
            [<Code>X-Timestamp</Code>, '当前时间戳（epoch 毫秒），签名校验时必填', '签名模式必填'],
            [<Code>X-Signature</Code>, 'HMAC-SHA256(secretKey, timestamp + "\\n" + body) 的 hex 小写', '签名模式必填'],
          ]}
        />
      </DocSection>

      {/* ========= 统一响应格式 ========= */}
      <DocSection title="统一响应格式">
        <p className="mb-3 text-sm text-slate-600">所有端点返回统一包装，HTTP 状态码总是 200，业务成功/失败看 <Code>code</Code>。</p>
        <Json
          title="成功响应"
          json={`{
  "code": 0,
  "message": "OK",
  "data": { ... }
}`}
        />
        <Json
          title="失败响应"
          json={`{
  "code": 40012,
  "message": "api key not found or disabled",
  "data": null
}`}
        />
        <DocTable
          headers={['code', '含义']}
          rows={[
            ['0', '成功'],
            ['400xx', '客户端错误（参数缺失、scope 不足、签名校验失败）'],
            ['401xx', '鉴权失败（API Key 无效/禁用）'],
            ['404xx', '资源不存在'],
            ['429xx', 'QPS 限流'],
            ['500xx', '服务端错误'],
          ]}
        />
      </DocSection>

      {/* ========= 权限 Scope ========= */}
      <DocSection title="权限 Scope">
        <p className="mb-3 text-sm text-slate-600">创建接入方时分配 scopes（逗号分隔），每个端点会校验所需权限：</p>
        <DocTable
          headers={['Scope', '可访问端点']}
          rows={[
            [<Code>user:read</Code>, 'GET /users, GET /users/{id}, GET /users/{id}/roles'],
            [<Code>user:write</Code>, 'POST /users, PUT /users/{id}, POST /users/batch'],
            [<Code>user_role:write</Code>, 'POST /users/{id}/roles/{roleId}, DELETE /users/{id}/roles/{roleId}'],
            [<Code>role:read</Code>, 'GET /roles, GET /roles/{id}, GET /roles/{id}/permissions'],
            [<Code>role:write</Code>, 'POST /roles, PUT /roles/{id}'],
            [<Code>role_permission:write</Code>, 'POST /roles/{id}/permissions/{permissionId}, DELETE ...'],
            [<Code>permission:read</Code>, 'GET /permissions, GET /permissions/{id}'],
            [<Code>permission:write</Code>, 'POST /permissions, PUT /permissions/{id}'],
            [<Code>change:read</Code>, 'GET /changes'],
          ]}
        />
      </DocSection>

      {/* ========= 用户 API ========= */}
      <DocSection title="用户 API">
        <p className="mb-4 text-sm text-slate-500">路径前缀 <Code>/api/v1/users</Code></p>

        {/* 创建/幂等 upsert */}
        <Endpoint method="POST" path="/api/v1/users" scope="user:write" desc="创建用户，携带 externalKey 时具备幂等性" />
        <DocTable
          headers={['参数', '类型', '必填', '说明', '示例']}
          rows={[
            ['username', 'string', '✅', '登录名，全局唯一', <Code>'zhangsan'</Code>],
            ['displayName', 'string', '❌', '显示名', <Code>'张三'</Code>],
            ['status', 'string', '❌', 'ACTIVE / DISABLED / LOCKED', <Code>'ACTIVE'</Code>],
            ['extraAttrs', 'string', '❌', '扩展属性 JSON 字符串', <Code>{'{"org":"医院信息科"}'}</Code>],
            ['externalKey', 'string', '❌', '第三方系统的用户唯一标识，用于幂等 upsert', <Code>'HIS_USER_10086'</Code>],
          ]}
        />
        <Json
          title="请求体"
          json={`{
  "username": "zhangsan",
  "displayName": "张三",
  "status": "ACTIVE",
  "externalKey": "HIS_USER_10086",
  "extraAttrs": "{\\"org\\":\\"医院信息科\\"}"
}`}
        />
        <Curl
          curl={`curl -X POST ${BASE}/api/v1/users \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "zhangsan",
    "displayName": "张三",
    "status": "ACTIVE",
    "externalKey": "HIS_USER_10086"
  }'`}
        />
        <Json
          title="响应 data（UserView）"
          json={`{
  "id": "3f2a6b1c-4e5d-7890-abcd-ef1234567890",
  "username": "zhangsan",
  "displayName": "张三",
  "status": "ACTIVE",
  "sourceType": "API",
  "sourceId": null,
  "externalKey": "HIS_USER_10086",
  "password": null,
  "gender": null,
  "department": null,
  "position": null,
  "phone": null,
  "email": null,
  "avatarUrl": null,
  "extraAttrs": "{\\"org\\":\\"医院信息科\\"}",
  "createdAt": "2026-09-02T01:30:00Z",
  "updatedAt": "2026-09-02T01:30:00Z",
  "createdBy": "cli_xxx",
  "updatedBy": "cli_xxx"
}`}
        />

        {/* 批量 upsert */}
        <Endpoint method="POST" path="/api/v1/users/batch" scope="user:write" desc="批量创建/更新，按 externalKey 幂等 upsert，适合初始化场景" />
        <p className="mb-3 text-sm text-slate-600">请求体是 <Code>UserWriteRequest[]</Code> 数组；每个元素的字段与单个创建相同。</p>
        <Json
          title="请求体"
          json={`[
  { "username": "lisi", "displayName": "李四", "externalKey": "HIS_USER_10087", "status": "ACTIVE" },
  { "username": "wangwu", "displayName": "王五", "externalKey": "HIS_USER_10088", "status": "ACTIVE" }
]`}
        />

        {/* 查询 */}
        <Endpoint method="GET" path="/api/v1/users" scope="user:read" desc="分页查询，支持 keyword（用户名/显示名）、sourceType、status 过滤" />
        <DocTable
          headers={['参数', '位置', '类型', '说明', '示例']}
          rows={[
            ['page', 'query', 'int', '页码从 0 开始，默认 0', <Code>0</Code>],
            ['size', 'query', 'int', '每页条数，默认 20，最大 100', <Code>50</Code>],
            ['keyword', 'query', 'string', '模糊匹配 username 或 displayName', <Code>'张'</Code>],
            ['sourceType', 'query', 'enum', 'SYNCED / API / CONSOLE', <Code>'SYNCED'</Code>],
            ['status', 'query', 'enum', 'ACTIVE / DISABLED / LOCKED', <Code>'ACTIVE'</Code>],
          ]}
        />
        <Curl
          curl={`curl -X GET "${BASE}/api/v1/users?page=0&size=20&sourceType=SYNCED&status=ACTIVE" \\
  -H "X-API-Key: YOUR_API_KEY"`}
        />

        {/* 详情 */}
        <Endpoint method="GET" path="/api/v1/users/{id}" scope="user:read" desc="用户详情" />

        {/* 更新 */}
        <Endpoint method="PUT" path="/api/v1/users/{id}" scope="user:write" desc="按 ID 更新（注：OpenAPI 写请求当前只支持 displayName/status/extraAttrs，其他字段需走同步或控制台）" />

        {/* 绑定角色 */}
        <Endpoint method="POST" path="/api/v1/users/{id}/roles/{roleId}" scope="user_role:write" desc="用户绑定角色（幂等，重复绑定不报错）" />
        <Endpoint method="DELETE" path="/api/v1/users/{id}/roles/{roleId}" scope="user_role:write" desc="用户解绑角色" />

        {/* 角色列表 */}
        <Endpoint method="GET" path="/api/v1/users/{id}/roles" scope="user:read" desc="用户的角色列表" />
      </DocSection>

      {/* ========= 角色 API ========= */}
      <DocSection title="角色 API">
        <p className="mb-4 text-sm text-slate-500">路径前缀 <Code>/api/v1/roles</Code></p>

        <Endpoint method="POST" path="/api/v1/roles" scope="role:write" desc="创建角色，externalKey 幂等" />
        <DocTable
          headers={['参数', '类型', '必填', '说明', '示例']}
          rows={[
            ['code', 'string', '✅', '角色编码，全局唯一', <Code>'ROLE_DOCTOR'</Code>],
            ['name', 'string', '❌', '显示名，不填则用 code', <Code>'医生'</Code>],
            ['description', 'string', '❌', '角色描述', <Code>'临床医生角色'</Code>],
            ['extraAttrs', 'string', '❌', '扩展属性 JSON', <Code>'{}'</Code>],
            ['externalKey', 'string', '❌', '第三方唯一标识，幂等创建用', <Code>'HIS_ROLE_100'</Code>],
          ]}
        />
        <Curl
          curl={`curl -X POST ${BASE}/api/v1/roles \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "ROLE_DOCTOR",
    "name": "医生",
    "description": "临床医生角色",
    "externalKey": "HIS_ROLE_100"
  }'`}
        />

        <Endpoint method="GET" path="/api/v1/roles" scope="role:read" desc="分页查询，支持 keyword / sourceType 过滤" />
        <Endpoint method="GET" path="/api/v1/roles/{id}" scope="role:read" desc="角色详情" />
        <Endpoint method="PUT" path="/api/v1/roles/{id}" scope="role:write" desc="更新角色（code 不可改）" />
        <Endpoint method="GET" path="/api/v1/roles/{id}/permissions" scope="role:read" desc="角色的权限列表" />
        <Endpoint method="POST" path="/api/v1/roles/{id}/permissions/{permissionId}" scope="role_permission:write" desc="角色绑定权限" />
        <Endpoint method="DELETE" path="/api/v1/roles/{id}/permissions/{permissionId}" scope="role_permission:write" desc="角色解绑权限" />
      </DocSection>

      {/* ========= 权限 API ========= */}
      <DocSection title="权限 API">
        <p className="mb-4 text-sm text-slate-500">路径前缀 <Code>/api/v1/permissions</Code></p>

        <Endpoint method="POST" path="/api/v1/permissions" scope="permission:write" desc="创建权限，externalKey 幂等" />
        <DocTable
          headers={['参数', '类型', '必填', '说明', '示例']}
          rows={[
            ['code', 'string', '✅', '权限编码，全局唯一，建议 "资源:动作" 格式', <Code>'user:read'</Code>],
            ['name', 'string', '❌', '显示名，不填则用 code', <Code>'用户查看'</Code>],
            ['description', 'string', '❌', '权限描述', <Code>'允许查看用户信息'</Code>],
            ['resourceType', 'enum', '❌', '资源类型：USER / ROLE / PERMISSION / MENU / API / DATA', <Code>'USER'</Code>],
            ['extraAttrs', 'string', '❌', '扩展属性 JSON', <Code>'{}'</Code>],
            ['externalKey', 'string', '❌', '第三方唯一标识，幂等创建用', <Code>'HIS_PERM_001'</Code>],
          ]}
        />
        <Curl
          curl={`curl -X POST ${BASE}/api/v1/permissions \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "user:read",
    "name": "用户查看",
    "resourceType": "USER",
    "externalKey": "HIS_PERM_001"
  }'`}
        />

        <Endpoint method="GET" path="/api/v1/permissions" scope="permission:read" desc="分页查询，支持 keyword / sourceType / resourceType 过滤" />
        <Endpoint method="GET" path="/api/v1/permissions/{id}" scope="permission:read" desc="权限详情" />
        <Endpoint method="PUT" path="/api/v1/permissions/{id}" scope="permission:write" desc="更新权限" />
      </DocSection>

      {/* ========= 变更查询 API ========= */}
      <DocSection title="增量变更查询 API">
        <p className="mb-3 text-sm text-slate-600">
          面向不想被动接收 Webhook 推送、而是想自己定时拉增量的第三方。返回自 <Code>since</Code> 时间之后发生变更的审计日志。
        </p>
        <Endpoint method="GET" path="/api/v1/changes" scope="change:read" desc="拉取指定时间之后的数据变更" />
        <DocTable
          headers={['参数', '位置', '类型', '必填', '说明', '示例']}
          rows={[
            ['since', 'query', 'long', '✅', '起始时间（epoch 毫秒，UTC）', <Code>1756771200000</Code>],
            ['entity', 'query', 'enum', '❌', '只看某类实体：USER / ROLE / PERMISSION / USER_ROLE / ROLE_PERMISSION', <Code>'USER'</Code>],
            ['page', 'query', 'int', '❌', '页码默认 0', <Code>0</Code>],
            ['size', 'query', 'int', '❌', '每页条数默认 100，最大 500', <Code>200</Code>],
          ]}
        />
        <Curl
          curl={`# 拉取 2026-09-01 00:00:00 之后所有用户变更
curl -X GET "${BASE}/api/v1/changes?since=1756771200000&entity=USER&size=100" \\
  -H "X-API-Key: YOUR_API_KEY"`}
        />
        <Json
          title="响应 data"
          json={`{
  "total": 42,
  "page": 0,
  "size": 100,
  "serverTimeMillis": 1756857600123,
  "items": [
    {
      "changeId": 1001,
      "entityType": "USER",
      "entityId": "3f2a6b1c-...",
      "entityCode": "zhangsan",
      "action": "CREATE",
      "channel": "API",
      "occurredAt": 1756857599000
    },
    {
      "changeId": 1002,
      "entityType": "ROLE",
      "entityId": "55e12f33-...",
      "entityCode": "ROLE_DOCTOR",
      "action": "UPDATE",
      "channel": "SYNC",
      "occurredAt": 1756857600010
    }
  ]
}`}
        />
        <DocTable
          headers={['items 字段', '类型', '说明']}
          rows={[
            ['changeId', 'long', '变更记录唯一 ID（递增），可用于断点续传'],
            ['entityType', 'enum', 'USER / ROLE / PERMISSION / USER_ROLE / ROLE_PERMISSION'],
            ['entityId', 'string', '业务实体 UUID'],
            ['entityCode', 'string', '业务编码（username / code 等），方便识别'],
            ['action', 'enum', 'CREATE / UPDATE / DELETE'],
            ['channel', 'string', '变更来源：API / SYNC / CONSOLE / WEBHOOK 等'],
            ['occurredAt', 'long', '变更发生时间（epoch 毫秒，UTC）'],
          ]}
        />
        <p className="mt-3 text-sm text-slate-600">
          <b>推荐用法</b>：首次调用取 <Code>since=0</Code> 拿到全量，之后每次用上一次响应的
          <Code>serverTimeMillis</Code> 作为下一次的 <Code>since</Code>。定时任务建议 30s~5min 一次。
        </p>
      </DocSection>

      {/* ========= 枚举值参考 ========= */}
      <DocSection title="枚举值参考">
        <DocTable
          headers={['枚举', '可选值']}
          rows={[
            ['EntityType', <span><Code>USER</Code>, <Code>ROLE</Code>, <Code>PERMISSION</Code>, <Code>USER_ROLE</Code>, <Code>ROLE_PERMISSION</Code></span>],
            ['EntityStatus', <span><Code>ACTIVE</Code>, <Code>DISABLED</Code>, <Code>LOCKED</Code></span>],
            ['SourceType', <span><Code>SYNCED</Code>（数据源同步）, <Code>API</Code>（开放 API）, <Code>CONSOLE</Code>（控制台手动）</span>],
            ['ResourceType', <span><Code>USER</Code>, <Code>ROLE</Code>, <Code>PERMISSION</Code>, <Code>MENU</Code>, <Code>API</Code>, <Code>DATA</Code></span>],
            ['ChangeAction', <span><Code>CREATE</Code>, <Code>UPDATE</Code>, <Code>DELETE</Code></span>],
          ]}
        />
      </DocSection>

      {/* ========= Python SDK 示例 ========= */}
      <DocSection title="Python 调用示例">
        <CodeBlock
          lang="python"
          code={`import requests

BASE = "http://localhost:8080/api/v1"
API_KEY = "tk_your_api_key_here"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# 幂等 upsert 用户
def upsert_user(username, display_name, external_key, status="ACTIVE"):
    resp = requests.post(f"{BASE}/users", headers=HEADERS, json={
        "username": username,
        "displayName": display_name,
        "status": status,
        "externalKey": external_key,
    })
    resp.raise_for_status()
    return resp.json()["data"]

# 拉增量变更
def pull_changes(since_epoch_ms, entity=None):
    params = {"since": since_epoch_ms, "size": 200}
    if entity:
        params["entity"] = entity
    resp = requests.get(f"{BASE}/changes", headers=HEADERS, params=params)
    resp.raise_for_status()
    payload = resp.json()["data"]
    return payload["items"], payload["serverTimeMillis"]

# —— 使用示例 ——
if __name__ == "__main__":
    # 批量初始化用户
    for u in [("zhangsan", "张三", "HIS_10086"), ("lisi", "李四", "HIS_10087")]:
        upsert_user(*u)

    # 拉取昨天之后的变更
    import time
    since = int(time.time() * 1000) - 86400_000
    items, next_since = pull_changes(since, entity="USER")
    print(f"拉到 {len(items)} 条用户变更，下次从 {next_since} 开始")`}
        />
      </DocSection>
    </div>
  )
}
