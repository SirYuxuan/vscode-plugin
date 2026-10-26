/**
 * VS Code 语言模型提供者：把配置的 OpenAI 兼容端点注册为 Copilot Chat 可选的模型。
 */

import * as vscode from 'vscode';
import { Logger } from '../../core/logging/logger';
import { LlmApiKeyStore } from './llmApiKeyStore';
import { LlmClient } from './llmClient';
import { LlmConfig } from './llmConfig';
import { LLM_COMMANDS, MODEL_VERSION } from './llmConstants';
import { convertMessages, convertTools, estimateTokens } from './llmMessageConverter';
import { ChatRequestBody, LlmSettings } from './llmTypes';

export class LlmChatProvider implements vscode.LanguageModelChatProvider, vscode.Disposable {
    private readonly changeEmitter = new vscode.EventEmitter<void>();

    /** 模型列表可能变化（配置或 API Key 改变）时触发。 */
    public readonly onDidChangeLanguageModelChatInformation = this.changeEmitter.event;

    private readonly subscriptions: vscode.Disposable[];

    constructor(
        private readonly config: LlmConfig,
        private readonly keys: LlmApiKeyStore,
        private readonly client: LlmClient,
        private readonly logger: Logger
    ) {
        this.subscriptions = [
            this.changeEmitter,
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (LlmConfig.affects(event)) {
                    this.changeEmitter.fire();
                }
            }),
            this.keys.onDidChange(() => this.changeEmitter.fire())
        ];
    }

    public async provideLanguageModelChatInformation(
        options: vscode.PrepareLanguageModelChatModelOptions,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelChatInformation[]> {
        let infos = await this.collectModels();

        if (infos.length === 0 && !options.silent) {
            await this.guideUserSetup();
            infos = await this.collectModels();
        }

        return infos;
    }

    public async provideLanguageModelChatResponse(
        model: vscode.LanguageModelChatInformation,
        messages: readonly vscode.LanguageModelChatRequestMessage[],
        options: vscode.ProvideLanguageModelChatResponseOptions,
        progress: vscode.Progress<vscode.LanguageModelResponsePart>,
        token: vscode.CancellationToken
    ): Promise<void> {
        const settings = this.config.read();
        const resolved = LlmConfig.resolve(settings, model.id);
        if (!resolved) {
            throw new Error(`模型 ${model.id} 的配置已被删除，请在设置中重新添加`);
        }

        const apiKey = await this.keys.get(resolved.endpoint.id);
        if (!apiKey) {
            throw new Error(`尚未设置 ${resolved.endpoint.name} 的 API Key，请先执行“设置 LLM API Key”`);
        }

        const converted = convertMessages(messages, resolved.model.vision);
        const tools = resolved.model.toolCalling ? convertTools(options.tools) : undefined;
        const body = this.buildBody(resolved.model.id, converted.messages, tools, options);

        this.logRequest(settings, resolved.endpoint.name, body, converted.sentImages, converted.omittedImages);

        await this.client.streamChat(
            { endpoint: resolved.endpoint, apiKey, body, timeoutMs: settings.requestTimeoutMs },
            {
                onText: (text) => progress.report(new vscode.LanguageModelTextPart(text)),
                onToolCall: (callId, name, input) =>
                    progress.report(new vscode.LanguageModelToolCallPart(callId, name, input))
            },
            token
        );
    }

    public async provideTokenCount(
        _model: vscode.LanguageModelChatInformation,
        text: string | vscode.LanguageModelChatRequestMessage,
        _token: vscode.CancellationToken
    ): Promise<number> {
        return estimateTokens(text);
    }

    public dispose(): void {
        vscode.Disposable.from(...this.subscriptions).dispose();
    }

    private buildBody(
        modelId: string,
        messages: ChatRequestBody['messages'],
        tools: ChatRequestBody['tools'],
        options: vscode.ProvideLanguageModelChatResponseOptions
    ): ChatRequestBody {
        const temperature = options.modelOptions?.temperature;

        return {
            model: modelId,
            messages,
            stream: true,
            ...(tools && { tools }),
            ...(tools && options.toolMode === vscode.LanguageModelChatToolMode.Required
                ? { tool_choice: 'required' as const }
                : {}),
            ...(typeof temperature === 'number' ? { temperature } : {})
        };
    }

    /** 只列出已设置 API Key 的端点下的模型。 */
    private async collectModels(): Promise<vscode.LanguageModelChatInformation[]> {
        const settings = this.config.read();
        const infos: vscode.LanguageModelChatInformation[] = [];

        for (const endpoint of settings.endpoints) {
            if (!(await this.keys.has(endpoint.id))) {
                continue;
            }

            for (const model of endpoint.models) {
                infos.push({
                    id: LlmConfig.toVsCodeModelId(endpoint.id, model.id),
                    name: model.name,
                    family: model.id,
                    version: MODEL_VERSION,
                    detail: endpoint.name,
                    tooltip: `${endpoint.name} · ${model.id}`,
                    maxInputTokens: model.maxInputTokens,
                    maxOutputTokens: model.maxOutputTokens,
                    capabilities: {
                        toolCalling: model.toolCalling,
                        imageInput: model.vision
                    }
                });
            }
        }

        return infos;
    }

    /** 用户主动管理模型但当前没有可用模型时，引导其完成配置。 */
    private async guideUserSetup(): Promise<void> {
        const settings = this.config.read();

        if (settings.endpoints.length === 0) {
            const action = await vscode.window.showInformationMessage(
                '尚未配置任何 LLM 端点，请先在设置中添加。',
                '打开设置'
            );
            if (action) {
                await vscode.commands.executeCommand(LLM_COMMANDS.openSettings);
            }
            return;
        }

        await vscode.commands.executeCommand(LLM_COMMANDS.setApiKey);
    }

    /** 仅在开启日志时记录请求摘要；不包含消息内容与密钥。 */
    private logRequest(
        settings: LlmSettings,
        endpointName: string,
        body: ChatRequestBody,
        sentImages: number,
        omittedImages: number
    ): void {
        if (!settings.logRequests) {
            return;
        }

        this.logger.info(`请求 ${endpointName}`, {
            model: body.model,
            fields: Object.keys(body),
            messages: body.messages.length,
            tools: body.tools?.map((tool) => tool.function.name) ?? [],
            toolChoice: body.tool_choice ?? null,
            sentImages,
            omittedImages,
            bodyBytes: Buffer.byteLength(JSON.stringify(body))
        });
    }
}
