/**
 * LLM 模型提供者的常量集合。
 *
 * 集中管理 vendor、命令 ID、配置键与各类默认值，避免在多个模块中硬编码。
 */

import { EXTENSION_ID } from '../../core/constants';

/** 在 package.json `languageModelChatProviders[].vendor` 中声明的提供者标识。 */
export const LLM_VENDOR = 'yuxuanllm';

/** 配置节点前缀，对应 package.json 中的 `yuxuanplugin.llm.*`。 */
export const LLM_CONFIG_SECTION = `${EXTENSION_ID}.llm`;

/** 配置节点下的各个配置键。 */
export const LLM_CONFIG_KEYS = {
    /** 端点列表。 */
    endpoints: 'endpoints',
    /** 单次请求的无响应超时（毫秒）。 */
    requestTimeout: 'requestTimeout',
    /** 是否记录脱敏的请求摘要。 */
    logRequests: 'logRequests'
} as const;

/** 与 package.json `contributes.commands[].command` 一致的命令 ID。 */
export const LLM_COMMANDS = {
    setApiKey: `${EXTENSION_ID}.llm.setApiKey`,
    clearApiKey: `${EXTENSION_ID}.llm.clearApiKey`,
    testEndpoint: `${EXTENSION_ID}.llm.testEndpoint`,
    openSettings: `${EXTENSION_ID}.llm.openSettings`,
    showLogs: `${EXTENSION_ID}.llm.showLogs`
} as const;

/** SecretStorage 中 API Key 的键前缀，后接端点 ID。 */
export const LLM_SECRET_PREFIX = `${EXTENSION_ID}.llm.apiKey.`;

/** VS Code 模型 ID 中端点 ID 与模型 ID 之间的分隔符（端点 ID 禁止包含该字符）。 */
export const MODEL_ID_SEPARATOR = '/';

/** 端点 ID 允许的字符集合，用作 SecretStorage 键与模型 ID 的一部分。 */
export const ENDPOINT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** 默认的请求无响应超时：120 秒，覆盖推理模型较长的首字延迟。 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

/** 模型未显式配置时的最大输入 token 数。 */
export const DEFAULT_MAX_INPUT_TOKENS = 128_000;

/** 模型未显式配置时的最大输出 token 数。 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;

/** 报告给 VS Code 的模型版本号，仅用于展示与选择器匹配。 */
export const MODEL_VERSION = '1.0.0';

/** 粗略估算 token 数时使用的字符/token 比，真实值以服务端为准。 */
export const CHARS_PER_TOKEN = 4;

/** 错误响应体写入报错信息时的最大长度，避免超长内容刷屏。 */
export const MAX_ERROR_BODY_CHARS = 500;

/** 模型不支持图片输入时，用于替代图片的占位文本。 */
export const IMAGE_PLACEHOLDER = '[图片已省略：当前模型未启用图片输入]';

/** 连通性测试发送的消息内容。 */
export const TEST_PROMPT = 'ping';

/** 流式响应中 Server-Sent Events 的数据行前缀。 */
export const SSE_DATA_PREFIX = 'data:';

/** 流式响应的结束标记。 */
export const SSE_DONE_MARKER = '[DONE]';
