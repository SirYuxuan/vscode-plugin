import { ToolResult } from '../toolTypes';

/** Base64 编码 / 解码（按 UTF-8 处理文本）。 */
export function base64(input: string, options: Record<string, unknown>): ToolResult {
    const action = String(options.action ?? 'encode');

    try {
        if (action === 'encode') {
            return { ok: true, output: Buffer.from(input, 'utf8').toString('base64') };
        }

        if (action === 'decode') {
            return { ok: true, output: Buffer.from(input.trim(), 'base64').toString('utf8') };
        }

        return { ok: false, error: `未知操作: ${action}` };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
