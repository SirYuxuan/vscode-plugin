import * as vscode from 'vscode';

/**
 * Webview 公共工具：生成 CSP nonce、拼装 HTML 骨架、解析 media 资源 URI。
 *
 * 工具台面板与 HTTP 响应面板共用，统一处理安全策略（CSP + nonce）与资源加载，
 * 避免各自重复样板。
 */
export class WebviewHost {
    /** 生成用于 CSP 的一次性随机 nonce。 */
    public static nonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let text = '';
        for (let i = 0; i < 32; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return text;
    }

    /** 将 media 目录下的相对文件解析为可在 Webview 中引用的 URI。 */
    public static mediaUri(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
        ...pathSegments: string[]
    ): vscode.Uri {
        return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', ...pathSegments));
    }

    /**
     * 组装带 CSP 的 HTML 页面。
     *
     * @param webview      目标 webview（用于取 cspSource）
     * @param nonce        脚本 nonce
     * @param styleUri     样式表 URI
     * @param scriptUri    脚本 URI
     * @param bodyHtml     <body> 内的初始 HTML
     * @param title        页面标题
     */
    public static html(
        webview: vscode.Webview,
        nonce: string,
        styleUri: vscode.Uri,
        scriptUri: vscode.Uri,
        bodyHtml: string,
        title: string
    ): string {
        const csp = [
            `default-src 'none'`,
            `style-src ${webview.cspSource}`,
            `font-src ${webview.cspSource}`,
            `img-src ${webview.cspSource} data:`,
            `script-src 'nonce-${nonce}'`
        ].join('; ');

        return `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>${title}</title>
</head>
<body>
${bodyHtml}
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
