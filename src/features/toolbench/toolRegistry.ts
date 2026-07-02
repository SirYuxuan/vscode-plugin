/**
 * 工具台的工具注册表。
 *
 * 每个工具是一个纯函数（`tools/` 下），在此登记为 `id → handler`。
 * 新增工具只需实现函数并加入此表，再在前端 `media/toolbench/main.js` 的
 * 工具清单里加一项即可——这是工具台的主要扩展点。
 */

import { ToolHandler, ToolResult } from './toolTypes';
import { base64 } from './tools/base64';
import { hash } from './tools/hash';
import { jsonYaml } from './tools/jsonYaml';
import { jwt } from './tools/jwt';
import { regex } from './tools/regex';
import { timestamp } from './tools/timestamp';
import { url } from './tools/url';
import { uuid } from './tools/uuid';

const TOOL_REGISTRY: Record<string, ToolHandler> = {
    jsonYaml,
    base64,
    jwt,
    hash,
    timestamp,
    url,
    uuid,
    regex
};

/** 执行指定工具；未知工具或抛错都会转成 ToolResult 错误返回。 */
export function runTool(tool: string, input: string, options: Record<string, unknown>): ToolResult {
    const handler = TOOL_REGISTRY[tool];

    if (!handler) {
        return { ok: false, error: `未知工具: ${tool}` };
    }

    try {
        return handler(input, options ?? {});
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
