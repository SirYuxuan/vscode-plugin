/**
 * XML → Java 跳转支持。
 *
 * 在 `.xml` 文件中识别全限定类名，将其渲染为可点击链接，跳转到对应的
 * Java 源文件。类名解析与缓存委托给 {@link JavaClassResolver}。
 */

import * as vscode from 'vscode';
import { JavaClassResolver } from '../../core/java/javaClassResolver';
import { Logger } from '../../core/logging/logger';
import { XmlClassScanner } from './xmlClassScanner';

/** DocumentLink 上附带的类名数据（延迟解析目标时使用）。 */
type ClassNameLink = vscode.DocumentLink & { data?: string };

export class XmlJavaClassLinkProvider implements vscode.DocumentLinkProvider {
    private readonly logger: Logger;

    constructor(
        private readonly resolver: JavaClassResolver,
        logger: Logger
    ) {
        this.logger = logger.scoped('XmlLink');
    }

    public async provideDocumentLinks(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.DocumentLink[]> {
        if (!document.fileName.toLowerCase().endsWith('.xml')) {
            return [];
        }

        const links: vscode.DocumentLink[] = [];

        for (const hit of XmlClassScanner.scan(document)) {
            const uri = await this.resolver.resolve(hit.className);
            if (!uri) {
                continue;
            }

            const link: ClassNameLink = new vscode.DocumentLink(hit.range, uri);
            link.data = hit.className;
            links.push(link);
        }

        this.logger.debug('生成链接数', String(links.length));
        return links;
    }

    public async resolveDocumentLink(
        link: vscode.DocumentLink,
        _token: vscode.CancellationToken
    ): Promise<vscode.DocumentLink | null> {
        if (link.target) {
            return link;
        }

        const className = (link as ClassNameLink).data?.trim();
        if (!className) {
            return null;
        }

        const uri = await this.resolver.resolve(className);
        if (!uri) {
            this.logger.debug('解析链接时未找到 Java 文件', className);
            return null;
        }

        link.target = uri;
        return link;
    }
}
