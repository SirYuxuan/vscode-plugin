/**
 * HTTP 请求发送。基于运行时内置的全局 `fetch`，用 AbortController 实现超时。
 */

/** 已解析变量、可直接发送的请求。 */
export interface ResolvedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
}

/** 请求结果。 */
export interface HttpResult {
    ok: boolean;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: string;
    contentType?: string;
    /** 耗时（毫秒）。 */
    elapsedMs: number;
    error?: string;
}

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

/** 发送请求并返回结构化结果；超时或网络错误以 ok=false 返回。 */
export async function sendRequest(request: ResolvedRequest, timeoutMs: number): Promise<HttpResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
        const method = request.method.toUpperCase();
        const response = await fetch(request.url, {
            method,
            headers: request.headers,
            // GET/HEAD 不能带 body，否则 fetch 会抛错。
            body: METHODS_WITHOUT_BODY.has(method) ? undefined : request.body,
            signal: controller.signal
        });

        const body = await response.text();
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            headers,
            body,
            contentType: response.headers.get('content-type') ?? '',
            elapsedMs: Date.now() - start
        };
    } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';
        return {
            ok: false,
            error: isAbort ? `请求超时（${timeoutMs}ms）` : error instanceof Error ? error.message : String(error),
            elapsedMs: Date.now() - start
        };
    } finally {
        clearTimeout(timer);
    }
}
