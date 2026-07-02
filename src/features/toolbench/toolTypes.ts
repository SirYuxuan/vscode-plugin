/** 工具台的通用类型定义。 */

/** Webview → 扩展宿主：请求执行某个工具。 */
export interface ToolRequestMessage {
    type: 'run';
    /** 关联请求与响应，避免过期结果覆盖新结果。 */
    id: number;
    tool: string;
    input: string;
    options: Record<string, unknown>;
}

/** 单个工具的执行结果。 */
export interface ToolResult {
    ok: boolean;
    /** 成功时的输出文本。 */
    output?: string;
    /** 失败时的错误信息。 */
    error?: string;
    /** 附加说明（如 JWT 过期时间），成功时可选。 */
    note?: string;
}

/** 工具处理函数签名：纯函数，不依赖 vscode。 */
export type ToolHandler = (input: string, options: Record<string, unknown>) => ToolResult;
