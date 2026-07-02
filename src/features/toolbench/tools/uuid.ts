import { randomUUID } from 'crypto';
import { ToolResult } from '../toolTypes';

/** 批量生成 UUID v4（数量 1-100）。 */
export function uuid(_input: string, options: Record<string, unknown>): ToolResult {
    const requested = Number(options.count ?? 1);
    const count = Math.min(Math.max(Number.isFinite(requested) ? Math.floor(requested) : 1, 1), 100);

    const list = Array.from({ length: count }, () => randomUUID());
    return { ok: true, output: list.join('\n') };
}
