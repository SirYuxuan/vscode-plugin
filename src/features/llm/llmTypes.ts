/**
 * LLM 模块使用的类型定义，包括用户配置与 OpenAI 兼容的 chat/completions 报文。
 */

/** 单个模型的配置。 */
export interface LlmModelConfig {
    /** 发送给服务端的模型名。 */
    readonly id: string;
    /** 在模型选择器中展示的名称。 */
    readonly name: string;
    /** 最大输入 token 数。 */
    readonly maxInputTokens: number;
    /** 最大输出 token 数。 */
    readonly maxOutputTokens: number;
    /** 是否支持工具调用。 */
    readonly toolCalling: boolean;
    /** 是否允许发送图片输入。关闭时图片会被替换为占位文本。 */
    readonly vision: boolean;
}

/** 单个端点（一个 OpenAI 兼容网关）的配置。 */
export interface LlmEndpointConfig {
    /** 端点唯一标识，同时用作 API Key 的存储键。 */
    readonly id: string;
    /** 展示名称。 */
    readonly name: string;
    /** 基础地址，已去除末尾斜杠，例如 `https://example.com/v1`。 */
    readonly baseUrl: string;
    /** 附加请求头，不含鉴权头。 */
    readonly headers: Readonly<Record<string, string>>;
    /** 该端点下的模型列表。 */
    readonly models: readonly LlmModelConfig[];
}

/** 读取并校验后的 LLM 设置。 */
export interface LlmSettings {
    readonly endpoints: readonly LlmEndpointConfig[];
    /** 请求无响应超时，毫秒。 */
    readonly requestTimeoutMs: number;
    /** 是否记录脱敏的请求摘要。 */
    readonly logRequests: boolean;
}

/** VS Code 模型 ID 解析后对应的端点与模型。 */
export interface ResolvedModel {
    readonly endpoint: LlmEndpointConfig;
    readonly model: LlmModelConfig;
}

/** chat/completions 的内容片段。 */
export type ChatContentPart =
    | { readonly type: 'text'; readonly text: string }
    | { readonly type: 'image_url'; readonly image_url: { readonly url: string } };

/** assistant 消息中的工具调用。 */
export interface ChatToolCall {
    readonly id: string;
    readonly type: 'function';
    readonly function: { readonly name: string; readonly arguments: string };
}

/** chat/completions 的消息。 */
export type ChatMessage =
    | { readonly role: 'user'; readonly content: string | readonly ChatContentPart[] }
    | {
          readonly role: 'assistant';
          readonly content: string;
          readonly tool_calls?: readonly ChatToolCall[];
      }
    | { readonly role: 'tool'; readonly content: string; readonly tool_call_id: string };

/** chat/completions 的工具定义。 */
export interface ChatTool {
    readonly type: 'function';
    readonly function: {
        readonly name: string;
        readonly description: string;
        readonly parameters: object;
    };
}

/** chat/completions 的请求体。 */
export interface ChatRequestBody {
    readonly model: string;
    readonly messages: readonly ChatMessage[];
    readonly stream: true;
    readonly tools?: readonly ChatTool[];
    readonly tool_choice?: 'required';
    readonly temperature?: number;
}

/** 流式响应中增量的工具调用片段。 */
export interface ChatToolCallDelta {
    readonly index?: number;
    readonly id?: string;
    readonly function?: { readonly name?: string; readonly arguments?: string };
}

/** 流式响应的单个数据块。 */
export interface ChatStreamChunk {
    readonly error?: { readonly message?: string };
    readonly choices?: ReadonlyArray<{
        readonly delta?: {
            readonly content?: string | null;
            readonly tool_calls?: readonly ChatToolCallDelta[];
        };
        readonly finish_reason?: string | null;
    }>;
}
