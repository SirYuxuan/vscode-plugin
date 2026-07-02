import { createHash } from 'crypto';
import { ToolResult } from '../toolTypes';

const SUPPORTED = ['md5', 'sha1', 'sha256', 'sha512'];

/** 生成常见哈希值（MD5 / SHA-1 / SHA-256 / SHA-512）。 */
export function hash(input: string, options: Record<string, unknown>): ToolResult {
    const algo = String(options.algo ?? 'sha256').toLowerCase();

    if (!SUPPORTED.includes(algo)) {
        return { ok: false, error: `不支持的算法: ${algo}` };
    }

    try {
        return { ok: true, output: createHash(algo).update(input, 'utf8').digest('hex') };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
