/**
 * 为 `.http` 文件中的每个请求块提供「发送请求」CodeLens。
 */

import * as vscode from 'vscode';
import { EXTENSION_ID } from '../../core/constants';
import { parseHttp } from './httpParser';

export class HttpCodeLensProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const { requests } = parseHttp(document.getText());

        return requests.map((request, index) => {
            const range = new vscode.Range(request.startLine, 0, request.startLine, 0);
            const title = request.name ? `▶ 发送请求 · ${request.name}` : '▶ 发送请求';

            return new vscode.CodeLens(range, {
                title,
                command: `${EXTENSION_ID}.sendHttpRequest`,
                arguments: [document.uri, index]
            });
        });
    }
}
