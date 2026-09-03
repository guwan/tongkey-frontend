import { Code, DocSection, DocTable } from './Docs'

/** 机器可读的数据模型字典（可导出 JSON，供第三方/AI 导入使用） */
export const DATA_DICTIONARY = {
  version: 'v1.0.0',
  entities: {
    User: {
      description: '用户（账号主体）',
      fields: [
        { name: 'id', type: 'string(uuid)', required: true, zh: '主键', en: 'Primary key', example: '3f2a...' },
        { name: 'username', type: 'string', required: true, zh: '用户名（唯一）', en: 'Login name, unique', example: 'zhangsan' },
        { name: 'displayName', type: 'string', required: false, zh: '显示名', en: 'Display name', example: '张三' },
        { name: 'status', type: 'enum(ENABLED|DISABLED)', required: true, zh: '状态', en: 'Status', example: 'ENABLED' },
        { name: 'sourceType', type: 'enum(NATIVE|SYNCED|API)', required: true, zh: '数据来源', en: 'Data origin', example: 'SYNCED' },
        { name: 'sourceId', type: 'string', required: false, zh: '来源标识（数据源 id / client_id）', en: 'Origin identifier', example: 'ds-001' },
        { name: 'externalKey', type: 'string', required: false, zh: '外部幂等键（同步/写入方提供）', en: 'External idempotency key', example: 'EMP0001' },
        { name: 'extraAttrs', type: 'json(string)', required: false, zh: '扩展属性', en: 'Extra attributes (JSON)', example: '{"dept":"研发部"}' },
        { name: 'createdAt', type: 'datetime(ISO-8601)', required: true, zh: '创建时间', en: 'Created at', example: '2026-08-28T02:00:00Z' },
        { name: 'updatedAt', type: 'datetime(ISO-8601)', required: true, zh: '更新时间', en: 'Updated at', example: '2026-08-28T03:00:00Z' },
        { name: 'createdBy', type: 'string', required: false, zh: '创建人/渠道', en: 'Created by', example: 'admin' },
        { name: 'updatedBy', type: 'string', required: false, zh: '最后修改人/渠道', en: 'Updated by', example: 'SYNC:HIS库' },
      ],
    },
    Role: {
      description: '角色',
      fields: [
        { name: 'id', type: 'string(uuid)', required: true, zh: '主键', en: 'Primary key', example: '8b1c...' },
        { name: 'code', type: 'string', required: true, zh: '角色编码（唯一）', en: 'Role code, unique', example: 'ROLE_DOCTOR' },
        { name: 'name', type: 'string', required: true, zh: '角色名称', en: 'Role name', example: '医生' },
        { name: 'description', type: 'string', required: false, zh: '描述', en: 'Description', example: '临床医生角色' },
        { name: 'sourceType', type: 'enum(NATIVE|SYNCED|API)', required: true, zh: '数据来源', en: 'Data origin', example: 'NATIVE' },
        { name: 'externalKey', type: 'string', required: false, zh: '外部幂等键', en: 'External idempotency key', example: 'R001' },
        { name: 'extraAttrs', type: 'json(string)', required: false, zh: '扩展属性', en: 'Extra attributes (JSON)', example: '{}' },
      ],
    },
    Permission: {
      description: '权限（资源访问点）',
      fields: [
        { name: 'id', type: 'string(uuid)', required: true, zh: '主键', en: 'Primary key', example: 'c9d0...' },
        { name: 'code', type: 'string', required: true, zh: '权限编码（唯一）', en: 'Permission code, unique', example: 'patient:read' },
        { name: 'name', type: 'string', required: true, zh: '权限名称', en: 'Permission name', example: '查看患者' },
        { name: 'resourceType', type: 'enum(MENU|BUTTON|API|DATA|OTHER)', required: true, zh: '资源类型', en: 'Resource type', example: 'API' },
        { name: 'description', type: 'string', required: false, zh: '描述', en: 'Description', example: '读取患者档案' },
        { name: 'sourceType', type: 'enum(NATIVE|SYNCED|API)', required: true, zh: '数据来源', en: 'Data origin', example: 'NATIVE' },
        { name: 'externalKey', type: 'string', required: false, zh: '外部幂等键', en: 'External idempotency key', example: 'P001' },
      ],
    },
    UserRole: {
      description: '用户-角色关联',
      fields: [
        { name: 'id', type: 'string(uuid)', required: true, zh: '主键', en: 'Primary key', example: '...' },
        { name: 'userId', type: 'string(uuid)', required: true, zh: '用户 id', en: 'User id', example: '3f2a...' },
        { name: 'roleId', type: 'string(uuid)', required: true, zh: '角色 id', en: 'Role id', example: '8b1c...' },
        { name: 'sourceType', type: 'enum(NATIVE|SYNCED|API)', required: true, zh: '关联来源', en: 'Link origin', example: 'SYNCED' },
      ],
    },
    RolePermission: {
      description: '角色-权限关联',
      fields: [
        { name: 'id', type: 'string(uuid)', required: true, zh: '主键', en: 'Primary key', example: '...' },
        { name: 'roleId', type: 'string(uuid)', required: true, zh: '角色 id', en: 'Role id', example: '8b1c...' },
        { name: 'permissionId', type: 'string(uuid)', required: true, zh: '权限 id', en: 'Permission id', example: 'c9d0...' },
        { name: 'sourceType', type: 'enum(NATIVE|SYNCED|API)', required: true, zh: '关联来源', en: 'Link origin', example: 'NATIVE' },
      ],
    },
  },
}

export default function DataDictionary() {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(DATA_DICTIONARY, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tongkey-data-dictionary.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <DocSection title="数据模型字典">
        <p className="mb-4 text-sm text-slate-600">
          所有实体的字段级说明（中英文、类型、是否必填、示例值）。本页数据为机器可读结构，
          <button onClick={exportJson} className="ml-1 text-blue-600 hover:underline">点击导出 JSON</button>
          ，可直接导入 Postman / 代码生成工具。
        </p>
        {Object.entries(DATA_DICTIONARY.entities).map(([name, entity]) => (
          <div key={name} className="mb-6">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              {name} <span className="ml-2 font-normal text-slate-400">{entity.description}</span>
            </h4>
            <DocTable
              headers={['字段', '类型', '必填', '中文说明', 'English', '示例']}
              rows={entity.fields.map((f) => [
                <Code>{f.name}</Code>,
                <span className="font-mono text-xs">{f.type}</span>,
                f.required ? '是' : '否',
                f.zh,
                <span className="text-slate-500">{f.en}</span>,
                <span className="font-mono text-xs text-slate-500">{f.example}</span>,
              ])}
            />
          </div>
        ))}
        <div className="rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-500">
          通用约定：<Code>sourceType</Code> 标识数据来自管理控制台（NATIVE）、第三方同步（SYNCED）还是开放 API 写入（API）；
          所有时间字段为 ISO-8601 UTC；所有分页接口返回 <Code>{'{ items, total, page, size }'}</Code>。
        </div>
      </DocSection>
    </div>
  )
}
