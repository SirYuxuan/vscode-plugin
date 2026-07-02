import { randomUUID } from 'crypto';

/** 变量来源，按优先级依次查找：文件变量 → 环境变量。 */
export interface VariableSources {
    fileVars: Record<string, string>;
    envVars: Record<string, string>;
}

const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
const RANDOM_INT_RE = /^\$randomInt\s+(-?\d+)\s+(-?\d+)$/;

/**
 * 解析文本中的 `{{var}}` 占位符。
 *
 * 查找顺序：动态变量（`$` 开头）→ 文件变量 → 环境变量。
 * 未能解析的占位符原样保留，便于用户发现拼写问题。
 */
export function resolveVariables(text: string, sources: VariableSources): string {
    return text.replace(PLACEHOLDER_RE, (_, rawName: string) => {
        const name = rawName.trim();

        if (name.startsWith('$')) {
            return resolveDynamic(name);
        }

        if (name in sources.fileVars) {
            return sources.fileVars[name];
        }

        if (name in sources.envVars) {
            return sources.envVars[name];
        }

        return `{{${name}}}`;
    });
}

/** 解析动态变量：`$timestamp`、`$uuid`、`$randomInt a b`。 */
function resolveDynamic(name: string): string {
    if (name === '$timestamp') {
        return String(Date.now());
    }

    if (name === '$uuid') {
        return randomUUID();
    }

    const randomInt = RANDOM_INT_RE.exec(name);
    if (randomInt) {
        const min = Number(randomInt[1]);
        const max = Number(randomInt[2]);
        if (max > min) {
            return String(min + Math.floor(Math.random() * (max - min)));
        }
    }

    return `{{${name}}}`;
}
