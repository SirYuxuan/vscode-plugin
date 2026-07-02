/**
 * `.http` 文件解析器（纯函数，无 I/O）。
 *
 * 语法参考 REST Client 风格：
 * - 以独占一行的 `###` 分隔多个请求；
 * - `@name = value` 定义文件级变量（全文件可见）；
 * - 注释行以 `#` 或 `//` 开头，`# @name xxx` 可为请求命名；
 * - 请求首行：`METHOD url [HTTP/x]`（省略 METHOD 时默认 GET）；
 * - 空行前为请求头，空行后为请求体。
 */

/** 一个解析出的 HTTP 请求。 */
export interface HttpRequest {
    /** 可选的请求名（来自 `# @name`）。 */
    name?: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    /** 请求首行所在的 0 基行号，用于放置 CodeLens。 */
    startLine: number;
}

/** 整个 `.http` 文档的解析结果。 */
export interface ParsedHttp {
    /** 文件级变量。 */
    variables: Record<string, string>;
    requests: HttpRequest[];
}

interface Line {
    text: string;
    line: number;
}

const VARIABLE_RE = /^@([A-Za-z0-9_\-.]+)\s*=\s*(.*)$/;
const REQUEST_LINE_RE = /^\s*([A-Za-z]+)\s+(\S.*?)(?:\s+HTTP\/[\d.]+)?\s*$/;
const NAME_RE = /@name\s+(.+)$/;

/** 解析 `.http` 文档文本。 */
export function parseHttp(text: string): ParsedHttp {
    const all: Line[] = text.split(/\r?\n/).map((content, line) => ({ text: content, line }));

    const variables: Record<string, string> = {};
    for (const { text: content } of all) {
        const match = VARIABLE_RE.exec(content);
        if (match) {
            variables[match[1]] = match[2].trim();
        }
    }

    const blocks: Line[][] = [[]];
    for (const item of all) {
        if (/^###/.test(item.text)) {
            blocks.push([]);
        } else {
            blocks[blocks.length - 1].push(item);
        }
    }

    const requests: HttpRequest[] = [];
    for (const block of blocks) {
        const request = parseBlock(block);
        if (request) {
            requests.push(request);
        }
    }

    return { variables, requests };
}

/** 解析单个请求块。 */
function parseBlock(block: Line[]): HttpRequest | undefined {
    let index = 0;
    let name: string | undefined;
    let requestLine: Line | undefined;

    // 跳过注释 / 空行 / 变量声明，定位请求首行。
    for (; index < block.length; index++) {
        const trimmed = block[index].text.trim();

        if (trimmed === '' || VARIABLE_RE.test(trimmed)) {
            continue;
        }

        if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
            const nameMatch = NAME_RE.exec(trimmed);
            if (nameMatch) {
                name = nameMatch[1].trim();
            }
            continue;
        }

        requestLine = block[index];
        break;
    }

    if (!requestLine) {
        return undefined;
    }

    const { method, url } = parseRequestLine(requestLine.text);
    if (!url) {
        return undefined;
    }

    // 解析请求头，直到遇到空行。
    const headers: Record<string, string> = {};
    index++;
    for (; index < block.length; index++) {
        const raw = block[index].text;
        if (raw.trim() === '') {
            index++;
            break;
        }

        const headerMatch = /^([^:]+):\s*(.*)$/.exec(raw);
        if (headerMatch) {
            headers[headerMatch[1].trim()] = headerMatch[2].trim();
        }
    }

    // 其余为请求体。
    const bodyLines: string[] = [];
    for (; index < block.length; index++) {
        bodyLines.push(block[index].text);
    }
    const body = bodyLines.join('\n').trim() || undefined;

    return { name, method, url, headers, body, startLine: requestLine.line };
}

/** 解析请求首行，缺省方法为 GET。 */
function parseRequestLine(text: string): { method: string; url: string } {
    const match = REQUEST_LINE_RE.exec(text);

    if (match && /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/i.test(match[1])) {
        return { method: match[1].toUpperCase(), url: match[2].trim() };
    }

    return { method: 'GET', url: text.trim() };
}
