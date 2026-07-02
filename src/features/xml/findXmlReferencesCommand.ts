/**
 * 「查找 XML 引用」命令（Java → XML 反向跳转）。
 *
 * 针对选中的 Java 源文件，推导其全限定类名，在工作区所有 XML 文件中搜索
 * 引用该类名的位置，并以 QuickPick 列出，选中后打开并定位。
 */

import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { EXTENSION_ID, LOCAL_MARKERS } from '../../core/constants';
import { Logger } from '../../core/logging/logger';
import { PathResolver } from '../../core/paths/pathResolver';

/** 一个 XML 文件中的引用命中。 */
interface XmlReference {
    uri: vscode.Uri;
    /** 首个匹配在文档中的字符偏移。 */
    offset: number;
    /** 匹配次数。 */
    count: number;
}

export class FindXmlReferencesCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.findXmlReferences`;

    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.scoped('FindXmlRefs');
    }

    public async execute(target?: vscode.Uri): Promise<void> {
        const className = this.resolveClassName(target);
        if (!className) {
            return;
        }

        this.logger.info('查找 XML 引用', className);

        const references = await this.searchReferences(className);

        if (references.length === 0) {
            vscode.window.showInformationMessage(`未找到引用 ${className} 的 XML 文件。`);
            return;
        }

        const picked = await this.pickReference(references, className);
        if (picked) {
            await this.reveal(picked);
        }
    }

    /** 由 Java 文件路径推导全限定类名；不合法时提示并返回 undefined。 */
    private resolveClassName(target?: vscode.Uri): string | undefined {
        if (!target?.fsPath) {
            vscode.window.showWarningMessage('请选择需要查找引用的 Java 文件。');
            return undefined;
        }

        const normalizedPath = PathResolver.normalize(target.fsPath);

        if (!normalizedPath.endsWith('.java') || !normalizedPath.includes(LOCAL_MARKERS.java)) {
            vscode.window.showWarningMessage('请选择 src/main/java 目录下的 Java 源文件。');
            return undefined;
        }

        const relative = PathResolver.relativeAfterMarker(normalizedPath, 'java');
        return relative.replace(/\.java$/, '').replace(/\//g, '.');
    }

    /** 在所有 XML 文件中搜索类名引用。 */
    private async searchReferences(className: string): Promise<XmlReference[]> {
        const files = await vscode.workspace.findFiles('**/*.xml', '**/node_modules/**');
        const references: XmlReference[] = [];

        for (const uri of files) {
            const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
            const offset = content.indexOf(className);

            if (offset === -1) {
                continue;
            }

            references.push({ uri, offset, count: this.countOccurrences(content, className) });
        }

        return references;
    }

    private countOccurrences(content: string, needle: string): number {
        let count = 0;
        let index = content.indexOf(needle);

        while (index !== -1) {
            count++;
            index = content.indexOf(needle, index + needle.length);
        }

        return count;
    }

    private async pickReference(references: XmlReference[], className: string): Promise<XmlReference | undefined> {
        const items = references.map((reference) => ({
            label: `$(file-code) ${vscode.workspace.asRelativePath(reference.uri)}`,
            description: reference.count > 1 ? `${reference.count} 处引用` : '1 处引用',
            reference
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: `找到 ${references.length} 个引用 ${className} 的 XML 文件`
        });

        return picked?.reference;
    }

    /** 打开目标文件并将光标定位到首个引用处。 */
    private async reveal(reference: XmlReference): Promise<void> {
        const document = await vscode.workspace.openTextDocument(reference.uri);
        const editor = await vscode.window.showTextDocument(document);
        const position = document.positionAt(reference.offset);

        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
}
