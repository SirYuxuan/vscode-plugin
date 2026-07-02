import { ToolResult } from '../toolTypes';

const MAX_PATTERN_LENGTH = 2000;
const MAX_INPUT_LENGTH = 20000;
const MAX_MATCHES = 10000;

/**
 * 正则实时测试：返回所有匹配及其分组。
 *
 * 出于对 ReDoS 的防护，对正则与文本长度设上限（在宿主进程执行，无法安全中断
 * 灾难性回溯），超限直接拒绝。
 */
export function regex(input: string, options: Record<string, unknown>): ToolResult {
    const pattern = String(options.pattern ?? '');
    const flags = String(options.flags ?? 'g');

    if (!pattern) {
        return { ok: false, error: '请输入正则表达式' };
    }

    if (pattern.length > MAX_PATTERN_LENGTH || input.length > MAX_INPUT_LENGTH) {
        return {
            ok: false,
            error: `输入过长（正则 ≤ ${MAX_PATTERN_LENGTH}，文本 ≤ ${MAX_INPUT_LENGTH}），已阻止以避免卡顿`
        };
    }

    const globalFlags = flags.includes('g') ? flags : flags + 'g';
    let re: RegExp;
    try {
        re = new RegExp(pattern, globalFlags);
    } catch (error) {
        return { ok: false, error: `正则无效: ${error instanceof Error ? error.message : String(error)}` };
    }

    const lines: string[] = [];
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = re.exec(input)) !== null) {
        count++;
        const groups =
            match.length > 1
                ? '\n  分组: ' + match.slice(1).map((group, i) => `$${i + 1}=${group ?? ''}`).join(', ')
                : '';
        lines.push(`#${count} @${match.index}: ${match[0]}${groups}`);

        // 防空匹配死循环；防超量匹配。
        if (match.index === re.lastIndex) {
            re.lastIndex++;
        }
        if (count >= MAX_MATCHES) {
            break;
        }
    }

    if (count === 0) {
        return { ok: true, output: '无匹配' };
    }

    return { ok: true, output: `共 ${count} 处匹配:\n${lines.join('\n')}` };
}
