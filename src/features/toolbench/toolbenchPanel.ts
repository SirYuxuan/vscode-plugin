/**
 * 开发者工具台的 Webview 面板（单例）。
 *
 * Webview 仅负责 UI；用户操作通过 postMessage 发到这里，由 {@link runTool}
 * 在扩展宿主计算后回传结果。面板隐藏时保留上下文（retainContextWhenHidden）。
 */

import * as vscode from 'vscode';
import { Logger } from '../../core/logging/logger';
import { WebviewHost } from '../../core/webview/webviewHost';
import { runTool } from './toolRegistry';
import { ToolRequestMessage } from './toolTypes';

export class ToolbenchPanel {
    private static readonly VIEW_TYPE = 'yuxuanToolbench';
    private static current: ToolbenchPanel | undefined;

    private readonly disposables: vscode.Disposable[] = [];
    private readonly logger: Logger;

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        logger: Logger
    ) {
        this.logger = logger.scoped('Toolbench');
        this.panel.webview.html = this.render(extensionUri);

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(
            (message: ToolRequestMessage) => this.onMessage(message),
            null,
            this.disposables
        );
    }

    /** 打开工具台；已存在则聚焦复用。 */
    public static show(extensionUri: vscode.Uri, logger: Logger): void {
        if (ToolbenchPanel.current) {
            ToolbenchPanel.current.panel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            ToolbenchPanel.VIEW_TYPE,
            '开发者工具台',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ToolbenchPanel.current = new ToolbenchPanel(panel, extensionUri, logger);
    }

    private onMessage(message: ToolRequestMessage): void {
        if (message?.type !== 'run') {
            return;
        }

        const result = runTool(message.tool, message.input ?? '', message.options ?? {});
        this.logger.debug('执行工具', { tool: message.tool, ok: result.ok });
        void this.panel.webview.postMessage({ type: 'result', id: message.id, result });
    }

    private render(extensionUri: vscode.Uri): string {
        const webview = this.panel.webview;
        const nonce = WebviewHost.nonce();
        const styleUri = WebviewHost.mediaUri(webview, extensionUri, 'toolbench', 'style.css');
        const scriptUri = WebviewHost.mediaUri(webview, extensionUri, 'toolbench', 'main.js');

        const body = `
<div id="app">
    <nav id="tool-nav" aria-label="工具列表"></nav>
    <section id="tool-pane">
        <header id="tool-header"></header>
        <div id="tool-controls"></div>
        <div id="tool-io">
            <textarea id="tool-input" spellcheck="false" placeholder="在此输入…"></textarea>
            <div id="tool-output-wrap">
                <div id="tool-note"></div>
                <pre id="tool-output"></pre>
            </div>
        </div>
    </section>
</div>`;

        return WebviewHost.html(webview, nonce, styleUri, scriptUri, body, '开发者工具台');
    }

    private dispose(): void {
        ToolbenchPanel.current = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }
}
