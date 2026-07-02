/**
 * HTTP 响应展示面板（单例 Webview）。
 *
 * 展示状态码、耗时、请求摘要、响应头与格式化后的响应体。
 * Webview 仅渲染，数据由扩展宿主通过 postMessage 推送。
 */

import * as vscode from 'vscode';
import { Logger } from '../../core/logging/logger';
import { WebviewHost } from '../../core/webview/webviewHost';
import { HttpResult, ResolvedRequest } from './httpClient';

export class HttpResponsePanel {
    private static readonly VIEW_TYPE = 'yuxuanHttpResponse';
    private static current: HttpResponsePanel | undefined;

    private readonly disposables: vscode.Disposable[] = [];

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private readonly logger: Logger
    ) {
        this.panel.webview.html = this.render(extensionUri);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    /** 确保面板存在并聚焦（在编辑器旁的第二列打开）。 */
    public static ensure(extensionUri: vscode.Uri, logger: Logger): HttpResponsePanel {
        if (HttpResponsePanel.current) {
            HttpResponsePanel.current.panel.reveal(vscode.ViewColumn.Beside, true);
            return HttpResponsePanel.current;
        }

        const panel = vscode.window.createWebviewPanel(
            HttpResponsePanel.VIEW_TYPE,
            'HTTP 响应',
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        HttpResponsePanel.current = new HttpResponsePanel(panel, extensionUri, logger);
        return HttpResponsePanel.current;
    }

    /** 显示「请求中」状态。 */
    public showLoading(request: ResolvedRequest): void {
        void this.panel.webview.postMessage({ type: 'loading', request });
    }

    /** 显示请求结果。 */
    public showResult(request: ResolvedRequest, result: HttpResult): void {
        this.logger.debug('展示响应', { url: request.url, ok: result.ok, status: result.status });
        void this.panel.webview.postMessage({ type: 'result', request, result });
    }

    private render(extensionUri: vscode.Uri): string {
        const webview = this.panel.webview;
        const nonce = WebviewHost.nonce();
        const styleUri = WebviewHost.mediaUri(webview, extensionUri, 'http', 'response.css');
        const scriptUri = WebviewHost.mediaUri(webview, extensionUri, 'http', 'response.js');

        const body = `
<div id="app">
    <div id="status-line" class="status-line">准备就绪</div>
    <div id="meta" class="meta"></div>
    <section class="block">
        <h3>请求</h3>
        <pre id="request-summary"></pre>
    </section>
    <section class="block">
        <h3>响应头</h3>
        <pre id="response-headers"></pre>
    </section>
    <section class="block">
        <h3>响应体</h3>
        <pre id="response-body"></pre>
    </section>
</div>`;

        return WebviewHost.html(webview, nonce, styleUri, scriptUri, body, 'HTTP 响应');
    }

    private dispose(): void {
        HttpResponsePanel.current = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }
}
