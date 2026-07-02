import { ToolResult } from '../toolTypes';

/**
 * 时间戳 ↔ 日期互转。
 * - 输入为纯数字：按时间戳解析（单位由 options.unit 指定，默认毫秒）；
 * - 输入为日期字符串：解析为时间戳；
 * - 输入为空：返回当前时间。
 */
export function timestamp(input: string, options: Record<string, unknown>): ToolResult {
    const unit = String(options.unit ?? 'ms');
    const trimmed = input.trim();

    if (!trimmed) {
        const now = Date.now();
        return {
            ok: true,
            output: [`毫秒: ${now}`, `秒: ${Math.floor(now / 1000)}`, `ISO: ${new Date(now).toISOString()}`].join('\n')
        };
    }

    if (/^\d+$/.test(trimmed)) {
        const value = Number(trimmed);
        const ms = unit === 's' ? value * 1000 : value;
        const date = new Date(ms);

        if (Number.isNaN(date.getTime())) {
            return { ok: false, error: '无效的时间戳' };
        }

        return { ok: true, output: [`ISO: ${date.toISOString()}`, `本地: ${date.toLocaleString()}`].join('\n') };
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
        return { ok: false, error: '无法解析该日期字符串' };
    }

    return {
        ok: true,
        output: [`毫秒: ${date.getTime()}`, `秒: ${Math.floor(date.getTime() / 1000)}`, `ISO: ${date.toISOString()}`].join(
            '\n'
        )
    };
}
