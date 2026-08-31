import { Code, CodeBlock, DocSection, DocTable } from './Docs'

export default function QuickStart() {
  return (
    <div>
      <DocSection title="1. 申请 API Key">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>由本系统管理员在管理控制台「开放 API 管理」中创建接入方，填写 <Code>client_id</Code>、名称，并按最小化原则勾选接口权限（scopes）。</li>
          <li>创建成功后一次性返回 <Code>API Key</Code> 与 <Code>Client Secret</Code>，请立即保存（Secret 之后不可再查看）。</li>
          <li>若接入方开启「强制签名校验」，还需用 Client Secret 对每个请求计算签名（见下方第 4 步）。</li>
        </ol>
      </DocSection>

      <DocSection title="2. 发起第一次请求（查询用户）">
        <p className="mb-3 text-sm text-slate-600">所有开放接口以 <Code>/api/v1</Code> 为前缀，请求头携带 <Code>X-API-Key</Code>：</p>
        <CodeBlock lang="bash" code={`curl -s "https://tongkey.example.com/api/v1/users?page=0&size=20" \\
  -H "X-API-Key: tk_xxxxxxxxxxxxxxxx"

# 响应（统一结构：code=0 成功，附 traceId 便于排障）
{
  "code": 0,
  "message": "成功",
  "data": {
    "items": [
      { "id": "...", "username": "zhangsan", "displayName": "张三",
        "status": "ACTIVE", "sourceType": "SYNCED" }
    ],
    "total": 1, "page": 0, "size": 20
  },
  "traceId": "9f8e7d6c"
}`} />
      </DocSection>

      <DocSection title="3. 语言示例">
        <div className="space-y-4">
          <CodeBlock lang="java" code={`// Java 11+ HttpClient
var client = java.net.http.HttpClient.newHttpClient();
var req = java.net.http.HttpRequest.newBuilder()
        .uri(java.net.URI.create("https://tongkey.example.com/api/v1/users?page=0&size=20"))
        .header("X-API-Key", "tk_xxxxxxxxxxxxxxxx")
        .GET()
        .build();
var resp = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
System.out.println(resp.body());`} />
          <CodeBlock lang="python" code={`# Python 3 requests
import requests

resp = requests.get(
    "https://tongkey.example.com/api/v1/users",
    params={"page": 0, "size": 20},
    headers={"X-API-Key": "tk_xxxxxxxxxxxxxxxx"},
    timeout=10,
)
data = resp.json()
assert data["code"] == 0, data["message"]
print(data["data"]["items"])`} />
        </div>
      </DocSection>

      <DocSection title="4. 签名校验（可选，防重放）">
        <p className="mb-3 text-sm text-slate-600">
          接入方开启「强制签名」后，每个请求需额外携带 <Code>X-Timestamp</Code>（epoch 秒）与 <Code>X-Signature</Code>：
        </p>
        <CodeBlock lang="text" code={`签名内容 content = HTTP方法 + "\\n" + 请求路径 + "\\n" + 时间戳 + "\\n" + 请求体
X-Signature = HMAC-SHA256(clientSecret, content)  // hex 小写

示例（GET /api/v1/users?page=0，无请求体）：
content = "GET\\n/api/v1/users\\n1735689600\\n"`} />
        <p className="mt-3 text-sm text-slate-600">
          时间戳与服务器偏差超过 <Code>300</Code> 秒返回错误码 <Code>20005</Code>；签名不匹配返回 <Code>20004</Code>。
        </p>
      </DocSection>

      <DocSection title="5. 主要接口一览">
        <DocTable
          headers={['接口', '方法', '路径', '所需 scope']}
          rows={[
            ['用户分页查询', <Code>GET</Code>, '/api/v1/users', 'user:read'],
            ['用户详情', <Code>GET</Code>, '/api/v1/users/{id}', 'user:read'],
            ['创建用户（幂等）', <Code>POST</Code>, '/api/v1/users', 'user:write'],
            ['更新用户', <Code>PUT</Code>, '/api/v1/users/{id}', 'user:write'],
            ['批量创建/更新用户', <Code>POST</Code>, '/api/v1/users/batch', 'user:write'],
            ['用户的角色', <Code>GET</Code>, '/api/v1/users/{id}/roles', 'user:read'],
            ['绑定/解绑用户角色', <Code>POST / DELETE</Code>, '/api/v1/users/{id}/roles/{roleId}', 'user_role:write'],
            ['角色分页查询 / 详情', <Code>GET</Code>, '/api/v1/roles', 'role:read'],
            ['创建 / 更新角色', <Code>POST / PUT</Code>, '/api/v1/roles', 'role:write'],
            ['角色的权限及授权', <Code>GET/POST/DELETE</Code>, '/api/v1/roles/{id}/permissions/...', 'role:read / role_permission:write'],
            ['权限分页查询 / 创建 / 更新', <Code>GET/POST/PUT</Code>, '/api/v1/permissions', 'permission:read / permission:write'],
            ['变更查询（增量拉取）', <Code>GET</Code>, '/api/v1/changes?sinceMillis=...', 'change:read'],
          ]}
        />
        <p className="mt-3 text-xs text-slate-400">
          写接口支持 <Code>externalKey</Code> 幂等：重复提交相同 externalKey 转为更新。分页参数：page（0 起）、size。
        </p>
      </DocSection>

      <DocSection title="6. 错误码">
        <DocTable
          headers={['code', '含义', '说明']}
          rows={[
            ['0', '成功', '-'],
            ['10001', '参数错误', '请求体/参数校验失败'],
            ['20001', '未认证', 'X-API-Key 缺失或无效'],
            ['20002', '无权限', '接入方被停用或缺少该接口 scope'],
            ['20003', '限流', '超出该接入方 QPS 上限（HTTP 429）'],
            ['20004', '签名校验失败', 'X-Signature 不匹配'],
            ['20005', '时间戳过期', '与服务器时间偏差过大'],
            ['30001', '资源不存在', 'id 不存在'],
            ['40001', '数据冲突', '业务冲突'],
            ['40002', '唯一标识已存在', '如 username / code 重复'],
            ['50000', '系统内部错误', '可凭 traceId 联系管理员'],
          ]}
        />
      </DocSection>
    </div>
  )
}
