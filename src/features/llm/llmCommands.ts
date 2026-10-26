/**
 * LLM 相关命令：设置 / 清除 API Key、连通性测试、打开设置与日志。
 */

import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { Logger } from '../../core/logging/logger';
import { LlmApiKeyStore } from './llmApiKeyStore';
import { LlmClient } from './llmClient';
import { LlmConfig } from './llmConfig';
import { LLM_COMMANDS, LLM_CONFIG_SECTION, TEST_PROMPT } from './llmConstants';
import { LlmEndpointConfig } from './llmTypes';

/** 在已配置的端点中让用户选择一个；仅有一个时直接返回。 */
async function pickEndpoint(
    config: LlmConfig,
    placeHolder: string
): Promise<LlmEndpointConfig | undefined> {
    const endpoints = config.read().endpoints;

    if (endpoints.length === 0) {
        const action = await vscode.window.showWarningMessage(
            '尚未配置任何 LLM 端点，请先在设置中添加。',
            '打开设置'
        );
        if (action) {
            await vscode.commands.executeCommand(LLM_COMMANDS.openSettings);
        }
        return undefined;
    }

    if (endpoints.length === 1) {
        return endpoints[0];
    }

    const picked = await vscode.window.showQuickPick(
        endpoints.map((endpoint) => ({
            label: endpoint.name,
            description: endpoint.baseUrl,
            endpoint
        })),
        { placeHolder }
    );

    return picked?.endpoint;
}

/** 设置端点的 API Key。 */
export class SetApiKeyCommand implements CommandContribution {
    public readonly id = LLM_COMMANDS.setApiKey;

    constructor(
        private readonly config: LlmConfig,
        private readonly keys: LlmApiKeyStore
    ) {}

    public async execute(): Promise<void> {
        const endpoint = await pickEndpoint(this.config, '选择要设置 API Key 的端点');
        if (!endpoint) {
            return;
        }

        const apiKey = await vscode.window.showInputBox({
            title: `设置 ${endpoint.name} 的 API Key`,
            prompt: 'Key 将加密保存在本机钥匙串中，不会写入设置文件',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => (value.trim() ? undefined : 'API Key 不能为空')
        });

        if (!apiKey) {
            return;
        }

        await this.keys.set(endpoint.id, apiKey.trim());
        void vscode.window.showInformationMessage(`已保存 ${endpoint.name} 的 API Key`);
    }
}

/** 清除端点的 API Key。 */
export class ClearApiKeyCommand implements CommandContribution {
    public readonly id = LLM_COMMANDS.clearApiKey;

    constructor(
        private readonly config: LlmConfig,
        private readonly keys: LlmApiKeyStore
    ) {}

    public async execute(): Promise<void> {
        const endpoint = await pickEndpoint(this.config, '选择要清除 API Key 的端点');
        if (!endpoint) {
            return;
        }

        await this.keys.delete(endpoint.id);
        void vscode.window.showInformationMessage(`已清除 ${endpoint.name} 的 API Key`);
    }
}

/** 向端点发送一条最小请求，验证地址、Key 与协议是否可用。 */
export class TestEndpointCommand implements CommandContribution {
    public readonly id = LLM_COMMANDS.testEndpoint;

    constructor(
        private readonly config: LlmConfig,
        private readonly keys: LlmApiKeyStore,
        private readonly client: LlmClient,
        private readonly logger: Logger
    ) {}

    public async execute(): Promise<void> {
        const endpoint = await pickEndpoint(this.config, '选择要测试的端点');
        if (!endpoint) {
            return;
        }

        const apiKey = await this.keys.get(endpoint.id);
        if (!apiKey) {
            void vscode.window.showWarningMessage(`尚未设置 ${endpoint.name} 的 API Key`);
            return;
        }

        const modelItems = endpoint.models.map((model) => ({ label: model.id, model }));
        const picked =
            modelItems.length === 1
                ? modelItems[0]
                : await vscode.window.showQuickPick(modelItems, { placeHolder: '选择要测试的模型' });
        if (!picked) {
            return;
        }

        const timeoutMs = this.config.read().requestTimeoutMs;

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `正在测试 ${endpoint.name} / ${picked.model.id}`,
                cancellable: true
            },
            async (_progress, token) => {
                const startedAt = Date.now();
                let received = '';

                try {
                    await this.client.streamChat(
                        {
                            endpoint,
                            apiKey,
                            timeoutMs,
                            body: {
                                model: picked.model.id,
                                messages: [{ role: 'user', content: TEST_PROMPT }],
                                stream: true
                            }
                        },
                        {
                            onText: (text) => {
                                received += text;
                            },
                            onToolCall: () => undefined
                        },
                        token
                    );

                    const elapsed = Date.now() - startedAt;
                    this.logger.info(
                        `连通性测试成功：${endpoint.name} / ${picked.model.id}，耗时 ${elapsed}ms，收到 ${received.length} 个字符`
                    );
                    void vscode.window.showInformationMessage(
                        `${endpoint.name} 连通正常（耗时 ${elapsed} 毫秒）`
                    );
                } catch (error) {
                    if (error instanceof vscode.CancellationError) {
                        return;
                    }

                    const message = error instanceof Error ? error.message : String(error);
                    this.logger.error(`连通性测试失败：${endpoint.name}`, message);
                    void vscode.window.showErrorMessage(`测试失败：${message}`);
                }
            }
        );
    }
}

/** 打开 LLM 相关设置。 */
export class OpenLlmSettingsCommand implements CommandContribution {
    public readonly id = LLM_COMMANDS.openSettings;

    public async execute(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openSettings', LLM_CONFIG_SECTION);
    }
}

/** 显示扩展日志面板。 */
export class ShowLlmLogsCommand implements CommandContribution {
    public readonly id = LLM_COMMANDS.showLogs;

    constructor(private readonly logger: Logger) {}

    public execute(): void {
        this.logger.show();
    }
}
