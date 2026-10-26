/**
 * LLM 设置的读取与校验。
 *
 * 配置来自用户设置 `yuxuanplugin.llm.*`。无效条目会被跳过并记录警告，
 * 不会让整个提供者因为单个错误配置而不可用。
 */

import * as vscode from 'vscode';
import { Logger } from '../../core/logging/logger';
import {
    DEFAULT_MAX_INPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    ENDPOINT_ID_PATTERN,
    LLM_CONFIG_KEYS,
    LLM_CONFIG_SECTION,
    MODEL_ID_SEPARATOR
} from './llmConstants';
import { LlmEndpointConfig, LlmModelConfig, LlmSettings, ResolvedModel } from './llmTypes';

type RawObject = Record<string, unknown>;

export class LlmConfig {
    constructor(private readonly logger: Logger) {}

    /**
     * 读取当前设置。
     * @returns 校验后的设置；无效条目已被剔除。
     */
    public read(): LlmSettings {
        const config = vscode.workspace.getConfiguration(LLM_CONFIG_SECTION);
        const rawEndpoints = config.get<unknown>(LLM_CONFIG_KEYS.endpoints, []);
        const timeout = config.get<number>(
            LLM_CONFIG_KEYS.requestTimeout,
            DEFAULT_REQUEST_TIMEOUT_MS
        );

        return {
            endpoints: this.parseEndpoints(rawEndpoints),
            requestTimeoutMs:
                Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_REQUEST_TIMEOUT_MS,
            logRequests: config.get<boolean>(LLM_CONFIG_KEYS.logRequests, false)
        };
    }

    /**
     * 判断配置变更事件是否影响 LLM 设置。
     * @param event 配置变更事件
     * @returns 影响 LLM 设置时为 true
     */
    public static affects(event: vscode.ConfigurationChangeEvent): boolean {
        return event.affectsConfiguration(LLM_CONFIG_SECTION);
    }

    /**
     * 生成提供给 VS Code 的模型 ID。
     * @param endpointId 端点 ID
     * @param modelId 模型名
     * @returns 形如 `endpoint/model` 的唯一 ID
     */
    public static toVsCodeModelId(endpointId: string, modelId: string): string {
        return `${endpointId}${MODEL_ID_SEPARATOR}${modelId}`;
    }

    /**
     * 把 VS Code 模型 ID 解析回端点与模型。
     * @param settings 当前设置
     * @param vsCodeModelId VS Code 模型 ID
     * @returns 解析结果；配置已被删除时返回 undefined
     */
    public static resolve(settings: LlmSettings, vsCodeModelId: string): ResolvedModel | undefined {
        // 端点 ID 不含分隔符，因此第一个分隔符之前必然是端点 ID；模型名本身可以包含 "/"。
        const separatorIndex = vsCodeModelId.indexOf(MODEL_ID_SEPARATOR);
        if (separatorIndex <= 0) {
            return undefined;
        }

        const endpointId = vsCodeModelId.slice(0, separatorIndex);
        const modelId = vsCodeModelId.slice(separatorIndex + 1);
        const endpoint = settings.endpoints.find((item) => item.id === endpointId);
        const model = endpoint?.models.find((item) => item.id === modelId);

        return endpoint && model ? { endpoint, model } : undefined;
    }

    private parseEndpoints(raw: unknown): LlmEndpointConfig[] {
        if (!Array.isArray(raw)) {
            return [];
        }

        const result: LlmEndpointConfig[] = [];
        const seenIds = new Set<string>();

        for (const item of raw) {
            const endpoint = this.parseEndpoint(item);
            if (!endpoint) {
                continue;
            }

            if (seenIds.has(endpoint.id)) {
                this.logger.warn(`端点 ID 重复，已忽略后出现的配置：${endpoint.id}`);
                continue;
            }

            seenIds.add(endpoint.id);
            result.push(endpoint);
        }

        return result;
    }

    private parseEndpoint(raw: unknown): LlmEndpointConfig | undefined {
        if (!isRawObject(raw)) {
            return undefined;
        }

        const id = asString(raw.id);
        if (!id || !ENDPOINT_ID_PATTERN.test(id)) {
            this.logger.warn(`端点 ID 无效（仅允许字母、数字、下划线与连字符）：${String(raw.id)}`);
            return undefined;
        }

        const baseUrl = normalizeBaseUrl(asString(raw.baseUrl));
        if (!baseUrl) {
            this.logger.warn(`端点 ${id} 的 baseUrl 无效，必须是 http(s) 地址`);
            return undefined;
        }

        const models = Array.isArray(raw.models)
            ? raw.models
                  .map((model) => this.parseModel(id, model))
                  .filter((model): model is LlmModelConfig => model !== undefined)
            : [];

        return {
            id,
            name: asString(raw.name) || id,
            baseUrl,
            headers: parseHeaders(raw.headers),
            models
        };
    }

    private parseModel(endpointId: string, raw: unknown): LlmModelConfig | undefined {
        if (!isRawObject(raw)) {
            return undefined;
        }

        const id = asString(raw.id);
        if (!id) {
            this.logger.warn(`端点 ${endpointId} 存在缺少 id 的模型配置，已忽略`);
            return undefined;
        }

        return {
            id,
            name: asString(raw.name) || id,
            maxInputTokens: asPositiveInt(raw.maxInputTokens, DEFAULT_MAX_INPUT_TOKENS),
            maxOutputTokens: asPositiveInt(raw.maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS),
            toolCalling: raw.toolCalling !== false,
            vision: raw.vision === true
        };
    }
}

function isRawObject(value: unknown): value is RawObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function asPositiveInt(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : fallback;
}

/** 仅保留值为字符串的请求头。 */
function parseHeaders(raw: unknown): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!isRawObject(raw)) {
        return headers;
    }

    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') {
            headers[key] = value;
        }
    }

    return headers;
}

/** 校验为 http(s) 地址并去除末尾斜杠；无效时返回空串。 */
function normalizeBaseUrl(value: string): string {
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return '';
        }
    } catch {
        return '';
    }

    return value.replace(/\/+$/, '');
}
