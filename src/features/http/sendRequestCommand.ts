/**
 * 「发送请求」命令。
 *
 * 既可由 CodeLens 触发（携带文档 URI + 请求索引），也可从命令面板触发
 * （使用当前编辑器与光标位置定位最近的请求）。解析变量后经 SFTP 之外的
 * HTTP 通道发送，并在响应面板展示。
 */

import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { ConfigManager } from '../../core/config/configManager';
import { EXTENSION_ID } from '../../core/constants';
import { Logger } from '../../core/logging/logger';
import { sendRequest, ResolvedRequest } from './httpClient';
import { HttpEnvironment } from './httpEnvironment';
import { HttpRequest, parseHttp } from './httpParser';
import { HttpResponsePanel } from './responsePanel';
import { resolveVariables, VariableSources } from './variableResolver';

export class SendRequestCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.sendHttpRequest`;

    private readonly logger: Logger;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly environment: HttpEnvironment,
        logger: Logger
    ) {
        this.logger = logger.scoped('HttpSend');
    }

    public async execute(uri?: vscode.Uri, index?: number): Promise<void> {
        const document = await this.resolveDocument(uri);
        if (!document) {
            vscode.window.showWarningMessage('请在 .http 文件中发送请求。');
            return;
        }

        const parsed = parseHttp(document.getText());
        if (parsed.requests.length === 0) {
            vscode.window.showWarningMessage('未在该文件中找到请求。');
            return;
        }

        const request = this.pickRequest(parsed.requests, index);
        if (!request) {
            vscode.window.showWarningMessage('未找到要发送的请求。');
            return;
        }

        const sources: VariableSources = {
            fileVars: parsed.variables,
            envVars: await this.environment.getActiveVars()
        };
        const resolved = this.resolveRequest(request, sources);

        this.logger.info('发送请求', `${resolved.method} ${resolved.url}`);

        const panel = HttpResponsePanel.ensure(this.extensionUri, this.logger);
        panel.showLoading(resolved);

        const result = await sendRequest(resolved, ConfigManager.getHttpConfig().timeout);
        panel.showResult(resolved, result);
    }

    /** 取文档：优先用传入 URI，否则用当前活动编辑器。 */
    private async resolveDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
        if (uri) {
            return vscode.workspace.openTextDocument(uri);
        }

        const active = vscode.window.activeTextEditor?.document;
        return active && active.fileName.toLowerCase().endsWith('.http') ? active : undefined;
    }

    /**
     * 选择请求：CodeLens 传了索引则直接用；否则取光标所在（或之前最近）的请求。
     */
    private pickRequest(requests: HttpRequest[], index?: number): HttpRequest | undefined {
        if (typeof index === 'number') {
            return requests[index];
        }

        const cursorLine = vscode.window.activeTextEditor?.selection.active.line ?? 0;
        let candidate: HttpRequest | undefined;
        for (const request of requests) {
            if (request.startLine <= cursorLine) {
                candidate = request;
            } else {
                break;
            }
        }

        return candidate ?? requests[0];
    }

    /** 对 URL / 头 / 体统一做变量替换。 */
    private resolveRequest(request: HttpRequest, sources: VariableSources): ResolvedRequest {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(request.headers)) {
            headers[key] = resolveVariables(value, sources);
        }

        return {
            method: request.method,
            url: resolveVariables(request.url, sources),
            headers,
            body: request.body ? resolveVariables(request.body, sources) : undefined
        };
    }
}
