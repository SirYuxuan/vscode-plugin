/**
 * XML 类名悬浮提示。
 *
 * 在 XML 中把鼠标悬停到全限定类名上时，展示其解析到的源文件路径，
 * 并提供打开链接，作为跳转能力的补充预览。
 */

import * as vscode from 'vscode';
import { JavaClassResolver } from '../../core/java/javaClassResolver';
import { Logger } from '../../core/logging/logger';
import { XmlClassScanner } from './xmlClassScanner';

export class XmlJavaClassHoverProvider implements vscode.HoverProvider {
    private readonly logger: Logger;

    constructor(
        private readonly resolver: JavaClassResolver,
        logger: Logger
    ) {
        this.logger = logger.scoped('XmlHover');
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        if (!document.fileName.toLowerCase().endsWith('.xml')) {
            return undefined;
        }

        const hit = XmlClassScanner.classNameAt(document, position);
        if (!hit) {
            return undefined;
        }

        const uri = await this.resolver.resolve(hit.className);
        if (!uri) {
            return undefined;
        }

        this.logger.debug('悬浮提示命中类名', hit.className);

        const markdown = new vscode.MarkdownString(undefined, true);
        markdown.isTrusted = true;
        markdown.appendMarkdown(`**${hit.className}**\n\n`);
        markdown.appendMarkdown(`[$(go-to-file) 打开源文件](${uri.toString()})\n\n`);
        markdown.appendMarkdown(`\`${uri.fsPath}\``);

        return new vscode.Hover(markdown, hit.range);
    }
}
