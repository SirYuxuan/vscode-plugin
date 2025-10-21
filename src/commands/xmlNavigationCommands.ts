import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class XmlJavaClassLinkProvider implements vscode.DocumentLinkProvider {

    public provideDocumentLinks(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentLink[]> {

        if (!document.fileName.endsWith('.xml')) {
            return [];
        }

        const links: vscode.DocumentLink[] = [];
        const text = document.getText();

        // 匹配 class="com.example.ClassName" 格式
        const classRegex = /class\s*=\s*["']([a-zA-Z_][a-zA-Z0-9_.]*[A-Z][a-zA-Z0-9_]*)["']/g;

        let match;
        while ((match = classRegex.exec(text)) !== null) {
            const className = match[1];

            // 验证是否为有效的Java类名
            if (this.isValidJavaClassName(className)) {
                const startPos = document.positionAt(match.index + match[0].indexOf(className));
                const endPos = document.positionAt(match.index + match[0].indexOf(className) + className.length);
                const range = new vscode.Range(startPos, endPos);

                const link = new vscode.DocumentLink(range);
                links.push(link);
            }
        }

        return links;
    }

    public async resolveDocumentLink(
        link: vscode.DocumentLink,
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentLink | null> {

        // 获取当前活动的文档
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return null;
        }

        const className = activeEditor.document.getText(link.range);
        const javaFile = await this.findJavaFile(className);

        if (javaFile) {
            link.target = javaFile;
        } else {
            // 找不到文件时显示提示
            await this.showNotFoundTips(className);
        }

        return link;
    }

    private isValidJavaClassName(className: string): boolean {
        const parts = className.split('.');
        if (parts.length < 2) {
            return false;
        }

        const actualClassName = parts[parts.length - 1];
        return /^[A-Z][a-zA-Z0-9]*$/.test(actualClassName);
    }

    private async findJavaFile(className: string): Promise<vscode.Uri | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        const classPath = className.replace(/\./g, '/') + '.java';

        for (const folder of workspaceFolders) {
            const possiblePaths = [
                'src/main/java/' + classPath,
                'src/java/' + classPath,
                'src/' + classPath,
                classPath
            ];

            for (const possiblePath of possiblePaths) {
                const fullPath = path.join(folder.uri.fsPath, possiblePath);

                try {
                    await fs.promises.access(fullPath);
                    return vscode.Uri.file(fullPath);
                } catch {
                    continue;
                }
            }
        }

        const files = await vscode.workspace.findFiles(
            '**/' + className.split('.').pop() + '.java',
            '**/node_modules/**',
            10
        );

        for (const file of files) {
            const fileContent = await vscode.workspace.fs.readFile(file);
            const content = Buffer.from(fileContent).toString('utf8');

            const packageDeclaration = className.split('.').slice(0, -1).join('.');
            if (content.includes('package ' + packageDeclaration + ';')) {
                return file;
            }
        }

        // 如果没有找到包名匹配的文件，返回null而不是第一个文件
        return null;
    }

    private async showNotFoundTips(className: string): Promise<void> {
        // 使用简单的右下角通知
        vscode.window.showWarningMessage(`找不到类文件: ${className}`);
    }
}
