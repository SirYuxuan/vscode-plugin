import { ToolResult } from '../toolTypes';

/** URL 编码 / 解码 / 结构拆解。 */
export function url(input: string, options: Record<string, unknown>): ToolResult {
    const action = String(options.action ?? 'encode');

    try {
        if (action === 'encode') {
            return { ok: true, output: encodeURIComponent(input) };
        }

        if (action === 'decode') {
            return { ok: true, output: decodeURIComponent(input) };
        }

        if (action === 'parse') {
            return { ok: true, output: parseUrl(input.trim()) };
        }

        return { ok: false, error: `未知操作: ${action}` };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/** 将 URL 拆成协议 / 主机 / 路径 / 查询参数等可读结构。 */
function parseUrl(value: string): string {
    const parsed = new URL(value);
    const lines = [`协议: ${parsed.protocol}`, `主机: ${parsed.host}`, `路径: ${parsed.pathname}`];

    const params = [...parsed.searchParams];
    if (params.length > 0) {
        lines.push('查询参数:');
        for (const [key, val] of params) {
            lines.push(`  ${key} = ${val}`);
        }
    }

    if (parsed.hash) {
        lines.push(`Hash: ${parsed.hash}`);
    }

    return lines.join('\n');
}
