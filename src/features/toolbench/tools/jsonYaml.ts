import * as yaml from 'js-yaml';
import { ToolResult } from '../toolTypes';

/** JSON / YAML 格式化与互转。 */
export function jsonYaml(input: string, options: Record<string, unknown>): ToolResult {
    const action = String(options.action ?? 'format-json');

    if (!input.trim()) {
        return { ok: true, output: '' };
    }

    try {
        switch (action) {
            case 'format-json':
                return { ok: true, output: JSON.stringify(JSON.parse(input), null, 2) };
            case 'minify-json':
                return { ok: true, output: JSON.stringify(JSON.parse(input)) };
            case 'json-to-yaml':
                return { ok: true, output: yaml.dump(JSON.parse(input)) };
            case 'yaml-to-json':
                return { ok: true, output: JSON.stringify(yaml.load(input), null, 2) };
            default:
                return { ok: false, error: `未知操作: ${action}` };
        }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
