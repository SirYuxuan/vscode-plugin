import { ToolResult } from '../toolTypes';

/** 解码 JWT 的 header 与 payload（不校验签名）。 */
export function jwt(input: string): ToolResult {
    const token = input.trim();
    if (!token) {
        return { ok: true, output: '' };
    }

    const parts = token.split('.');
    if (parts.length < 2) {
        return { ok: false, error: '不是有效的 JWT（应为 header.payload.signature）' };
    }

    try {
        const header = decodeSegment(parts[0]);
        const payload = decodeSegment(parts[1]);
        const output = JSON.stringify({ header, payload }, null, 2);

        return { ok: true, output, note: describeExpiry(payload) };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/** 解码 base64url 段为 JSON 对象。 */
function decodeSegment(segment: string): unknown {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

/** 根据 payload.exp 生成过期说明。 */
function describeExpiry(payload: unknown): string | undefined {
    if (typeof payload !== 'object' || payload === null) {
        return undefined;
    }

    const exp = (payload as Record<string, unknown>).exp;
    if (typeof exp !== 'number') {
        return undefined;
    }

    const expiresAt = new Date(exp * 1000);
    const expired = expiresAt.getTime() < Date.now();

    return `exp: ${expiresAt.toISOString()}${expired ? ' （已过期）' : ''}`;
}
