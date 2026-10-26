/**
 * LLM 功能的装配入口。
 *
 * 构建配置、密钥存储、HTTP 客户端与模型提供者，并向 VS Code 注册提供者；
 * 同时返回需要由 {@link CommandManager} 统一注册的命令。
 */

import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { Logger } from '../../core/logging/logger';
import { LlmApiKeyStore } from './llmApiKeyStore';
import { LlmChatProvider } from './llmChatProvider';
import { LlmClient } from './llmClient';
import {
    ClearApiKeyCommand,
    OpenLlmSettingsCommand,
    SetApiKeyCommand,
    ShowLlmLogsCommand,
    TestEndpointCommand
} from './llmCommands';
import { LlmConfig } from './llmConfig';
import { LLM_VENDOR } from './llmConstants';

/**
 * 注册 LLM 模型提供者，并返回其命令。
 * @param context 扩展上下文，注册的资源会登记到其 subscriptions
 * @param logger 全局日志
 * @returns 需要注册的命令列表
 */
export function registerLlmFeature(
    context: vscode.ExtensionContext,
    logger: Logger
): CommandContribution[] {
    const llmLogger = logger.scoped('llm');
    const config = new LlmConfig(llmLogger);
    const keys = new LlmApiKeyStore(context.secrets);
    const client = new LlmClient(llmLogger);
    const provider = new LlmChatProvider(config, keys, client, llmLogger);

    context.subscriptions.push(
        keys,
        provider,
        vscode.lm.registerLanguageModelChatProvider(LLM_VENDOR, provider)
    );
    provider.refresh();

    return [
        new SetApiKeyCommand(config, keys),
        new ClearApiKeyCommand(config, keys),
        new TestEndpointCommand(config, keys, client, llmLogger),
        new OpenLlmSettingsCommand(),
        new ShowLlmLogsCommand(logger)
    ];
}
