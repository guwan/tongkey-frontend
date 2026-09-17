import { Code, CodeBlock, DocSection, DocTable } from './Docs'

const HOST = 'https://tongkey.example.com'

export default function OAuth2Doc() {
  return (
    <div>
      {/* ========= 概述 ========= */}
      <DocSection title="OAuth 2.0 登录授权（Authorization Code）">
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          TongKey 实现了 <Code>OAuth 2.0 授权码模式（RFC 6749 §4.1）</Code>。第三方系统（接入方）可以引导
          TongKey 用户在浏览器中登录并授权，随后拿到 <Code>access_token</Code>，以
          <Code> Authorization: Bearer </Code> 方式调用 <Code>/api/v1/**</Code> 开放接口，
          与 <Code>X-API-Key</Code> 通道完全等价。
        </p>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li><b>授权主体</b>：TongKey 用户（管理控制台「用户管理」中的账号，需已设置登录密码），不是控制台管理员。</li>
          <li><b>支持的 grant_type</b>：<Code>authorization_code</Code>、<Code>refresh_token</Code>。不支持 implicit / password / client_credentials。</li>
          <li><b>令牌形态</b>：access_token 为 HS256 签名的 JWT（默认 2 小时）；refresh_token 为不透明随机串（默认 30 天，使用即旋转）。</li>
          <li><b>最小权限</b>：令牌携带的 scope 是接入方全量 scope 与用户授权 scope 的交集，接口按令牌 scope 鉴权。</li>
          <li><b>AI 对接友好</b>：token 端点同时接受 form-urlencoded 与 application/json；文末提供无头系统（AI Agent / CLI / 桌面程序）的 loopback 完整 Python 示例。</li>
        </ul>
      </DocSection>

      {/* ========= 前置条件 ========= */}
      <DocSection title="1. 前置条件（管理员一次性配置）">
        <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>管理员在控制台「开放 API 管理」创建/编辑接入方，记录 <Code>client_id</Code> 与 <Code>client_secret</Code>（创建时仅显示一次）。</li>
          <li>勾选接口权限 <Code>oauth2:login</Code>（没有该 scope 的接入方调用授权端点会返回 <Code>unauthorized_client</Code>）。</li>
          <li>填写「OAuth2 回调地址白名单」：一行一个，例如 <Code>http://127.0.0.1:8765/callback</Code>、<Code>https://your-app.com/oauth/callback</Code>。授权请求中的 <Code>redirect_uri</Code> 必须与白名单<b>逐字符完全一致</b>。</li>
          <li>参与登录授权的用户需已在「用户管理」中设置登录密码（用户列表 → 编辑 → 重置登录密码）。</li>
        </ol>
        <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
          本文示例统一使用服务地址 <Code>{HOST}</Code>；本地开发替换为 <Code>http://localhost:8080</Code>。
        </div>
      </DocSection>

      {/* ========= 端点总览 ========= */}
      <DocSection title="2. 端点总览">
        <DocTable
          headers={['方法 & 路径', '用途', '调用方']}
          rows={[
            [<><Code>GET</Code> <Code>{HOST}/oauth2/authorize</Code></>, '授权入口：未登录渲染登录页，已登录渲染授权同意页，最终 302 回跳 redirect_uri', '浏览器（用户）'],
            [<><Code>POST</Code> <Code>{HOST}/oauth2/authorize/login</Code></>, '用户用户名+密码登录，成功下发 HttpOnly 会话 Cookie', '浏览器（登录表单）'],
            [<><Code>POST</Code> <Code>{HOST}/oauth2/authorize/consent</Code></>, '用户同意/拒绝授权；同意则签发一次性授权码并 302 回跳', '浏览器（同意表单）'],
            [<><Code>POST</Code> <Code>{HOST}/oauth2/token</Code></>, '授权码换令牌 / refresh_token 刷新；RFC 原生 JSON（非统一包装）', '接入方后端/脚本'],
            [<><Code>GET</Code> <Code>{HOST}/api/v1/me</Code></>, '查看当前令牌身份与生效 scope（两种鉴权通道均可）', '接入方'],
          ]}
        />
      </DocSection>

      {/* ========= 流程 ========= */}
      <DocSection title="3. 授权码全流程（4 步）">
        <CodeBlock lang="text" code={`① 用户浏览器  →  GET /oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...
                   服务端：未登录→登录页；已登录→同意页

② 用户在页面输入 TongKey 用户名/密码 → POST /oauth2/authorize/login（Set-Cookie: tk_oauth_session; HttpOnly）
   登录成功自动回到授权页，用户点「同意授权」→ POST /oauth2/authorize/consent

③ 服务端 302 → redirect_uri?code=一次性授权码(10分钟)&state=原样透传
   （拒绝时 302 → redirect_uri?error=access_denied&state=...）

④ 接入方后端用 code 换令牌：
   POST /oauth2/token  (Basic 认证 client_id:client_secret)
   → { "access_token": "<JWT>", "refresh_token": "...", "token_type": "Bearer",
       "expires_in": 7200, "scope": "user:read ..." }

之后：Authorization: Bearer <access_token> 调用 /api/v1/**`} />
      </DocSection>

      {/* ========= authorize ========= */}
      <DocSection title="4. 发起授权：GET /oauth2/authorize">
        <DocTable
          headers={['参数', '必填', '说明']}
          rows={[
            [<Code>response_type</Code>, '✅', '固定 <Code>code</Code>，其他值返回错误页 unsupported_response_type'],
            [<Code>client_id</Code>, '✅', '接入方 ID；不存在/停用返回错误页'],
            [<Code>redirect_uri</Code>, '✅', '回调地址，必须与控制台白名单完全一致（含端口、路径、末尾斜杠）'],
            [<Code>scope</Code>, '—', '空格分隔的 scope 列表，必须是接入方已授权 scope 的子集；不传则默认申请接入方全部 scope'],
            [<Code>state</Code>, '建议', '任意随机串，原样回跳，用于防 CSRF；请务必校验'],
          ]}
        />
        <div className="mt-3">
          <CodeBlock lang="bash" code={`# 在浏览器打开（或让用户点击）
${HOST}/oauth2/authorize?response_type=code \\
  &client_id=oa-system \\
  &redirect_uri=http%3A%2F%2F127.0.0.1%3A8765%2Fcallback \\
  &scope=user%3Aread%20role%3Aread \\
  &state=8f3c2a7b9e1d4f60`} />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          <b>两种错误形态：</b>当 <Code>client_id</Code> / <Code>redirect_uri</Code> 不可信时，服务端直接展示中文错误页且<b>不做跳转</b>（防开放重定向）；
          当请求合法但用户拒绝、或 scope 不合法时，以 302 回到 <Code>redirect_uri</Code> 并携带
          <Code> error</Code> / <Code>error_description</Code> / <Code>state</Code>。
        </p>
        <DocTable
          headers={['回跳 error 值', '含义']}
          rows={[
            [<Code>access_denied</Code>, '用户在同意页点击了拒绝'],
            [<Code>invalid_scope</Code>, '申请的 scope 超出接入方范围（错误页提示）'],
          ]}
        />
      </DocSection>

      {/* ========= token ========= */}
      <DocSection title="5. 换取令牌：POST /oauth2/token">
        <p className="mb-3 text-sm text-slate-600">
          客户端认证两种方式任选其一：HTTP Basic（推荐）或在请求体中放 <Code>client_id</Code>/<Code>client_secret</Code>。
          请求体支持 <Code>application/x-www-form-urlencoded</Code> 与 <Code>application/json</Code>。
        </p>
        <DocTable
          headers={['参数', '适用 grant_type', '说明']}
          rows={[
            [<Code>grant_type</Code>, '全部', 'authorization_code 或 refresh_token'],
            [<Code>code</Code>, 'authorization_code', '第 3 步拿到的授权码，单次使用，10 分钟内有效'],
            [<Code>redirect_uri</Code>, 'authorization_code', '必须与第 4 步完全一致，否则 invalid_grant'],
            [<Code>refresh_token</Code>, 'refresh_token', '上次令牌响应中的刷新令牌；用过后立即作废并下发新的（旋转）'],
          ]}
        />
        <div className="mt-3 space-y-3">
          <CodeBlock lang="bash" code={`# 方式 A：Basic 认证 + 表单（标准做法）
curl -s -X POST "${HOST}/oauth2/token" \\
  -u "oa-system:你的client_secret" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  --data-urlencode "grant_type=authorization_code" \\
  --data-urlencode "code=第3步回调收到的code" \\
  --data-urlencode "redirect_uri=http://127.0.0.1:8765/callback"`} />
          <CodeBlock lang="bash" code={`# 方式 B：JSON 请求体（方便 AI/脚本对接，凭证放 body）
curl -s -X POST "${HOST}/oauth2/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "client_id": "oa-system",
    "client_secret": "你的client_secret",
    "code": "第3步回调收到的code",
    "redirect_uri": "http://127.0.0.1:8765/callback"
  }'`} />
          <div className="mb-1 text-xs font-medium text-slate-500">
            成功响应（RFC §5.1 原生格式，注意不是 TongKey 的 {'{code,message,data}'} 包装）
          </div>
          <CodeBlock lang="json" code={`{
  "access_token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOi...（JWT）...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "scope": "user:read role:read",
  "refresh_token": "MkX7...（不透明随机串，仅本次返回明文）"
}`} />
        </div>
      </DocSection>

      {/* ========= 错误码 ========= */}
      <DocSection title="6. 令牌端点错误（RFC §5.2）">
        <p className="mb-3 text-sm text-slate-600">错误响应 HTTP 状态码语义化，body 为 <Code>{"{error, error_description}"}</Code>；401 时带 <Code>WWW-Authenticate: Basic</Code> 头。</p>
        <CodeBlock lang="json" code={`HTTP/1.1 400 Bad Request
Content-Type: application/json

{ "error": "invalid_grant", "error_description": "授权码无效或已过期" }`} />
        <div className="mt-3">
          <DocTable
            headers={['error', 'HTTP', '触发场景']}
            rows={[
              [<Code>invalid_request</Code>, '400', '缺少 grant_type/code/redirect_uri，或同时用两种方式传客户端凭证'],
              [<Code>invalid_client</Code>, '401', 'client_id/secret 错误、接入方停用；响应带 WWW-Authenticate'],
              [<Code>invalid_grant</Code>, '400', '授权码错误/过期/已使用/归属不符、redirect_uri 不一致、refresh_token 失效'],
              [<Code>unauthorized_client</Code>, '400', '接入方未开通 oauth2:login（该场景在授权页阶段即被拦截）'],
              [<Code>unsupported_grant_type</Code>, '400', 'grant_type 不是 authorization_code / refresh_token'],
            ]}
          />
        </div>
      </DocSection>

      {/* ========= 调用 API ========= */}
      <DocSection title="7. 使用 access_token 调用开放 API">
        <CodeBlock lang="bash" code={`curl -s "${HOST}/api/v1/users?page=0&size=20" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...."

# 响应仍是 TongKey 统一包装
# { "code": 0, "message": "成功", "data": { "items": [...], "total": 42, ... }, "traceId": "..." }`} />
        <p className="mb-3 mt-3 text-sm text-slate-600">
          令牌 scope 不足时返回业务码 <Code>20002</Code>（FORBIDDEN，HTTP 403），message 会提示缺少的 scope。
          可随时调用 <Code>GET /api/v1/me</Code> 自检令牌身份：
        </p>
        <div className="mb-1 text-xs font-medium text-slate-500">GET /api/v1/me（Bearer 通道）</div>
        <CodeBlock lang="json" code={`{
  "code": 0,
  "message": "成功",
  "data": {
    "channel": "oauth2",
    "client": { "clientId": "oa-system", "name": "OA 办公系统" },
    "scopes": ["user:read", "role:read"],
    "user": { "id": "f1c2...", "username": "zhangsan", "displayName": "张三" }
  },
  "traceId": "..."
}`} />
      </DocSection>

      {/* ========= refresh ========= */}
      <DocSection title="8. 刷新令牌：refresh_token">
        <p className="mb-3 text-sm text-slate-600">
          access_token 过期前/后都可用 refresh_token 换新。<b>每次刷新旧 refresh_token 立即作废</b>，响应会下发新的一对令牌，请用最新值覆盖本地保存。
        </p>
        <CodeBlock lang="bash" code={`curl -s -X POST "${HOST}/oauth2/token" \\
  -u "oa-system:你的client_secret" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  --data-urlencode "grant_type=refresh_token" \\
  --data-urlencode "refresh_token=上次响应里的refresh_token"`} />
        <p className="mt-3 text-sm text-slate-600">
          刷新失败（<Code>invalid_grant</Code>）意味着刷新令牌过期/被旋转/被吊销，必须让用户重新走一遍授权流程，不要自动重试密码登录。
        </p>
      </DocSection>

      {/* ========= JWT 结构 ========= */}
      <DocSection title="9. access_token（JWT）结构">
        <p className="mb-3 text-sm text-slate-600">JWT 三段式 <Code>header.payload.signature</Code>，HS256 对称签名。请在服务端验签并以 <Code>exp</Code> 判断过期，不要只依赖 <Code>expires_in</Code>。</p>
        <DocTable
          headers={['Claim', '说明']}
          rows={[
            [<Code>iss</Code>, '签发方，固定 tongkey'],
            [<Code>sub</Code>, '授权用户 ID（tk_user 主键）'],
            [<Code>username</Code>, '授权用户名'],
            [<Code>client_id</Code>, '接入方 ID'],
            [<Code>scope</Code>, '空格分隔的实际授权 scope（接口鉴权以此为准）'],
            [<Code>typ</Code>, '固定 access，防止 refresh 等其他令牌混用'],
            [<Code>iat / exp</Code>, '签发/过期时间（epoch 秒），默认有效期 7200 秒'],
            [<Code>jti</Code>, '令牌唯一 ID'],
          ]}
        />
        <CodeBlock lang="bash" code={`# 本地解析 payload（无需验签，仅查看）
echo "eyJhbGciOiJIUzI1NiJ9.<payload>.<sig>" | cut -d. -f2 | base64 -d 2>/dev/null`} />
      </DocSection>

      {/* ========= AI/无头系统 ========= */}
      <DocSection title="10. AI / 无头系统接入：loopback 回调完整示例">
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          没有固定后端域名的 AI Agent、CLI、桌面程序，使用 <Code>http://127.0.0.1:&lt;随机端口&gt;/callback</Code>
          作为回调（RFC 8252 loopback）：在本机临时起一个 HTTP 服务接收 code，再用 code 换 token。
          前提：管理员已把该 loopback 地址（端口可每次固定）加入接入方白名单。
        </p>
        <CodeBlock lang="python" code={`#!/usr/bin/env python3
# pip install requests
# 用法：python tongkey_oauth_login.py
import http.server, secrets, threading, urllib.parse, webbrowser, requests

BASE = "http://localhost:8080"          # TongKey 地址（生产换成 https://...）
CLIENT_ID = "oa-system"
CLIENT_SECRET = "你的client_secret"
REDIRECT_URI = "http://127.0.0.1:8765/callback"
SCOPE = "user:read role:read"

result = {}
done = threading.Event()

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if self.path.startswith("/callback"):
            if "code" not in q:
                result["error"] = q.get("error", ["未知错误"])[0]
            else:
                result["code"] = q["code"][0]
                result["state"] = q.get("state", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h2>授权完成，可以关闭本页面并回到终端。</h2>".encode())
            done.set()
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *a):  # 静音
        pass

srv = http.server.HTTPServer(("127.0.0.1", 8765), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

state = secrets.token_hex(8)
auth_url = (f"{BASE}/oauth2/authorize?response_type=code"
            f"&client_id={CLIENT_ID}"
            f"&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
            f"&scope={urllib.parse.quote(SCOPE)}&state={state}")
print("浏览器将打开授权页，登录并同意：", auth_url)
webbrowser.open(auth_url)

if not done.wait(timeout=300):           # 最多等 5 分钟
    raise SystemExit("等待授权回调超时")
srv.shutdown()
if "error" in result:
    raise SystemExit(f"用户拒绝或授权失败: {result['error']}")
assert result["state"] == state, "state 不一致，疑似 CSRF，中止"

# 用 code 换令牌
tok = requests.post(f"{BASE}/oauth2/token",
                    auth=(CLIENT_ID, CLIENT_SECRET),                # HTTP Basic
                    data={"grant_type": "authorization_code",
                          "code": result["code"],
                          "redirect_uri": REDIRECT_URI},
                    timeout=10).json()
print("令牌响应:", tok)

# 用 Bearer 令牌调业务接口
me = requests.get(f"{BASE}/api/v1/me",
                  headers={"Authorization": f"Bearer {tok['access_token']}"},
                  timeout=10).json()
print("当前身份:", me)`} />
        <div className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
          AI 读者注：上面的脚本没有任何交互式输入之外的前提；请用管理员给的真实 client_id / client_secret 替换常量。
          令牌端点接受 JSON body，纯 HTTP 环境下也可以不依赖浏览器表单库，直接用 <Code>{'requests.post(json={...})'}</Code> 传参。
        </div>
      </DocSection>

      {/* ========= 安全 ========= */}
      <DocSection title="11. 安全注意事项">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li><b>state 必传并校验</b>：回调后先比对 state 再使用 code，防 CSRF。</li>
          <li><b>client_secret 仅在服务端使用</b>：不要放进前端 SPA / 移动 App；纯前端应用请使用 loopback 或后端代理。</li>
          <li><b>redirect_uri 精确白名单</b>：末尾斜杠、大小写、端口不同都视为不匹配，这是有意的安全设计。</li>
          <li><b>授权码一次性</b>：使用后立刻作废，重放返回 invalid_grant。</li>
          <li><b>refresh_token 旋转</b>：刷新成功旧令牌即失效；本地持久化时注意文件权限。</li>
          <li><b>最小 scope</b>：只申请业务必需的 scope；接口鉴权按令牌内 scope 而非接入方全量 scope。</li>
          <li><b>HTTPS</b>：生产环境必须全站 HTTPS；授权 Cookie 在 HTTPS 下自动带 Secure 属性。</li>
          <li><b>令牌不透明存储</b>：授权码与刷新令牌在服务端数据库仅保存 SHA-256 哈希。</li>
        </ul>
      </DocSection>

      {/* ========= nginx ========= */}
      <DocSection title="12. 反向代理（nginx）配置片段">
        <p className="mb-3 text-sm text-slate-600">
          授权端点依赖浏览器跳转与 Cookie 透传，nginx 需代理 <Code>/oauth2</Code> 并转发 <Code>Host</Code> 与 <Code>X-Forwarded-Proto</Code>（服务端据此给 Cookie 加 Secure）：
        </p>
        <CodeBlock lang="nginx" code={`location /oauth2/ {
    proxy_pass http://127.0.0.1:8180;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;   # 必须由 nginx 覆盖下发，勿信任客户端自带值
}

# 调 API 的 Bearer 通道走已有 /api 代理即可，无需额外配置
# location /api/ { proxy_pass http://127.0.0.1:8180/; ... }`} />
        <p className="mt-2 text-xs text-slate-400">
          服务端依据 X-Forwarded-Proto 决定会话 Cookie 是否加 Secure，务必由 nginx 直接设置该头（proxy_set_header 是覆盖语义），不要透传客户端传入值。
        </p>
      </DocSection>
    </div>
  )
}
