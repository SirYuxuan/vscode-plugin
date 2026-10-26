/**
 * OpenAI 兼容 chat/completions 的 HTTP 客户端（流式）。
 *
 * 负责鉴权头、超时、取消与错误信息整理；API Key 不会写入日志或错误信息。
 */

import * as vscode from 'vscode';
import { Logger } from '../../core/logging/logger';
import { MAX_ERROR_BODY_CHARS } from './llmConstants';
import { ChatStreamParser, StreamHandlers } from './llmStreamParser';
import { ChatRequestBody, LlmEndpointConfig } from './llmTypes';

/** 一次流式请求所需的全部信息。 */
export interface LlmStreamRequest {
    readonly endpoint: LlmEndpointConfig;
    readonly apiKey: string;
    readonly body: ChatRequestBody;
    /** 无响应超时，毫秒；每收到一段数据会重新计时。 */
    readonly timeoutMs: number;
}

/** 请求失败，信息可直接展示给用户。 */
export class LlmRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LlmRequestError';
    }
}

export class LlmClient {
    constructor(private readonly logger: Logger) {}

    /**
     * 发送流式请求，并把增量结果通过回调送出。
     * @param request 请求信息
     * @param handlers 文本与工具调用的接收方
     * @param token 取消令牌
     * @throws LlmRequestError 网络失败、超时或服务端返回非 2xx
     * @throws vscode.CancellationError 请求被取消
     */
    public async streamChat(
        request: LlmStreamRequest,
        handlers: StreamHandlers,
        token: vscode.CancellationToken
    ): Promise<void> {
        const controller = new AbortController();
        let timedOut = false;
        let timer: NodeJS.Timeout | undefined;

        const armTimer = (): void => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, request.timeoutMs);
        };

        const cancelSubscription = token.onCancellationRequested(() => controller.abort());

        try {
            armTimer();
            const response = await fetch(`${request.endpoint.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.buildHeaders(request),
                body: JSON.stringify(request.body),
                signal: controller.signal
            });

            if (!response.ok) {
                throw await this.toHttpError(request.endpoint, response);
            }

            if (!response.body) {
                throw new LlmRequestError(`${request.endpoint.name} 返回了空的响应体`);
            }

            const parser = new ChatStreamParser(handlers);
            const decoder = new TextDecoder();
            const reader = response.body.getReader();

            for (;;) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                armTimer();
                parser.push(decoder.decode(value, { stream: true }));
            }

            parser.push(decoder.decode());
            parser.finish();
        } catch (error) {
            if (token.isCancellationRequested) {
                throw new vscode.CancellationError();
            }

            if (timedOut) {
                throw new LlmRequestError(
                    `${request.endpoint.name} 在 ${request.timeoutMs} 毫秒内没有响应`
                );
            }

            if (error instanceof LlmRequestError) {
                throw error;
            }

            throw this.toNetworkError(request.endpoint, error);
        } finally {
            clearTimeout(timer);
            cancelSubscription.dispose();
        }
    }

    private buildHeaders(request: LlmStreamRequest): Record<string, string> {
        // 自定义头在前，保证鉴权头与内容类型不会被覆盖。
        return {
            ...request.endpoint.headers,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${request.apiKey}`
        };
    }

    private async toHttpError(
        endpoint: LlmEndpointConfig,
        response: Response
    ): Promise<LlmRequestError> {
        const body = (await response.text().catch(() => '')).slice(0, MAX_ERROR_BODY_CHARS);
        this.logger.error(`${endpoint.name} 返回 HTTP ${response.status}`, body);

        const hint =
            response.status === 401 || response.status === 403
                ? '（请检查 API Key 是否正确、是否有权限）'
                : '';

        return new LlmRequestError(
            `${endpoint.name} 返回 HTTP ${response.status}${hint}：${body || response.statusText}`
        );
    }

    private toNetworkError(endpoint: LlmEndpointConfig, error: unknown): LlmRequestError {
        const base = error instanceof Error ? error.message : String(error);
        const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
        const detail = cause instanceof Error ? `${base}（${cause.message}）` : base;

        this.logger.error(`请求 ${endpoint.name} 失败`, detail);
        return new LlmRequestError(`无法访问 ${endpoint.name}：${detail}`);
    }
}
