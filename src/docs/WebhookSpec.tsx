import { Code, CodeBlock, DocSection, DocTable } from './Docs'

export default function WebhookSpec() {
  return (
    <div>
      <DocSection title="概述">
        <p className="text-sm leading-relaxed text-slate-600">
          TongKey 支持将用户/角色/权限数据的变更主动推送到第三方系统（Webhook）。第三方作为
          <b>接收端</b>，需要提供一个 HTTP 端点并按本规范处理报文。推送在数据落库事务提交后触发，
          失败按目标配置的重试策略自动重试，也可在管理控制台手动重推。
        </p>
      </DocSection>

      <DocSection title="1. 报文格式">
        <p className="mb-3 text-sm text-slate-600">请求方法默认 <Code>POST</Code>，Content-Type 为 <Code>application/json</Code>。</p>
        <div className="mb-3">
          <div className="mb-1 text-xs font-medium text-slate-500">增量事件报文（ON_CREATE / ON_UPDATE / ON_DELETE）：</div>
          <CodeBlock lang="json" code={`{
  "event": "ON_UPDATE",
  "action": "UPDATE",
  "entityType": "USER",
  "entityId": "3f2a6b1c-...",
  "data": {
    "id": "3f2a6b1c-...",
    "username": "zhangsan",
    "displayName": "张三",
    "status": "ACTIVE",
    "sourceType": "SYNCED"
  },
  "timestamp": "2026-08-28T03:15:42.123Z"
}`} />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">全量初始化报文（ON_INIT，分批发送）：</div>
          <CodeBlock lang="json" code={`{
  "event": "ON_INIT",
  "entityType": "USER",
  "total": 500,
  "data": [ { "id": "...", "username": "..." } ],
  "timestamp": "2026-08-28T03:15:42.123Z"
}`} />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          管理控制台可为每个推送目标配置「报文模板」（目标字段 → 源字段映射），覆盖默认报文结构。
        </p>
      </DocSection>

      <DocSection title="2. 签名校验（推荐开启）">
        <p className="mb-3 text-sm text-slate-600">
          推送目标鉴权方式选择 <Code>HMAC_SIGNATURE</Code> 时，每个请求附带以下请求头，接收端应校验后再处理：
        </p>
        <DocTable
          headers={['请求头', '说明']}
          rows={[
            [<Code>X-TongKey-Signature</Code>, 'HMAC-SHA256(secretKey, timestamp + "\\n" + body) 的 hex 小写（请求头名可自定义）'],
            [<Code>X-TongKey-Timestamp</Code>, 'epoch 毫秒；建议拒绝偏差过大的请求（防重放）'],
          ]}
        />
        <p className="mt-2 text-sm text-slate-600">其他可选鉴权：<Code>BASIC</Code>（HTTP Basic）、<Code>BEARER</Code>（Authorization: Bearer token）。</p>
      </DocSection>

      <DocSection title="3. 期望的响应">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>返回任意 <Code>2xx</Code> 状态码即视为接收成功，推送完成。</li>
          <li>返回非 2xx 或超时（连接 10s / 读取 30s）视为失败，进入重试队列。</li>
          <li>重试策略由推送目标配置：<Code>重试次数</Code> + <Code>重试间隔</Code>；超出后标记失败，可在管理控制台手动重推。</li>
          <li>接收端应尽量在 30 秒内返回；耗时处理请异步入队后快速响应。</li>
          <li>建议按 <Code>entityType + entityId + event</Code> 做幂等去重（重试可能重复投递）。</li>
        </ul>
      </DocSection>

      <DocSection title="4. 接收端示例（伪代码）">
        <CodeBlock lang="python" code={`import hashlib, hmac, json

SECRET = "与 TongKey 推送目标配置一致的 secretKey"
MAX_SKEW_MS = 5 * 60 * 1000

def tongkey_webhook(request):
    body = request.body_bytes                      # 原始请求体（勿重新序列化）
    timestamp = int(request.headers["X-TongKey-Timestamp"])
    signature = request.headers["X-TongKey-Signature"]

    # 1. 防重放：时间戳偏差检查
    if abs(now_millis() - timestamp) > MAX_SKEW_MS:
        return 401, "timestamp expired"

    # 2. 验签：HMAC-SHA256(secret, timestamp + "\\n" + body)
    expected = hmac.new(SECRET.encode(),
                        f"{timestamp}\\n".encode() + body,
                        hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return 401, "bad signature"

    # 3. 幂等处理后入队
    payload = json.loads(body)
    if already_processed(payload["entityType"], payload["entityId"], payload["event"]):
        return 200, "duplicated"
    enqueue(payload)
    return 200, "ok"`} />
      </DocSection>
    </div>
  )
}
