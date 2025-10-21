import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class XmlNavigationCommands {

    public async jumpToJavaClass(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showWarningMessage('请先打开一个XML文件');
                return;
            }

            let className = '';
            const selection = activeEditor.selection;

            if (!selection.isEmpty) {
                className = activeEditor.document.getText(selection);
            } else {
                const currentLine = activeEditor.document.lineAt(activeEditor.selection.active.line);
                const lineText = currentLine.text;

                const classMatch = lineText.match(/class\s*=\s*["']([^"']+)["']/);
                if (classMatch) {
                    className = classMatch[1];
                } else {
                    vscode.window.showWarningMessage('未找到类路径，请选中类名或确保光标在包含class属性的行上');
                    return;
                }
            }

            className = className.trim();
            if (!className) {
                vscode.window.showWarningMessage('类路径为空');
                return;
            }

            if (!this.isValidJavaClassName(className)) {
                vscode.window.showWarningMessage('不是有效的Java类路径: ' + className);
                return;
            }

            await this.navigateToClass(className);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage('跳转到Java类时出错: ' + errorMessage);
        }
    }

    private isValidJavaClassName(className: string): boolean {
        const parts = className.split('.');
        if (parts.length < 2) {
            return false;
        }

        const actualClassName = parts[parts.length - 1];
        return /^[A-Z][a-zA-Z0-9]*$/.test(actualClassName);
    }

    private async navigateToClass(className: string): Promise<void> {
        const javaFile = await this.findJavaFile(className);

        if (javaFile) {
            const document = await vscode.workspace.openTextDocument(javaFile);
            await vscode.window.showTextDocument(document);
        } else {
            // 显示找不到文件的详细提示信息
            await this.showNotFoundTips(className);
        }
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

        return files.length > 0 ? files[0] : null;
    }

    private async createJavaFile(className: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('没有打开的工作区');
            return;
        }

        const packageName = className.split('.').slice(0, -1).join('.');
        const simpleClassName = className.split('.').pop()!;

        const relativePath = 'src/main/java/' + className.replace(/\./g, '/') + '.java';
        const fullPath = path.join(workspaceFolders[0].uri.fsPath, relativePath);

        const dir = path.dirname(fullPath);
        await fs.promises.mkdir(dir, { recursive: true });

        const content = 'package ' + packageName + ';\n\npublic class ' + simpleClassName + ' {\n    \n}\n';

        await fs.promises.writeFile(fullPath, content, 'utf8');

        const document = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(document);
    }

    private async showNotFoundTips(className: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        // 构建提示信息
        let tipsMessage = `找不到类文件: ${className}\n\n`;
        tipsMessage += '💡 查找建议:\n';

        if (workspaceFolders) {
            const searchPaths = [
                'src/main/java/',
                'src/java/',
                'src/',
                ''
            ];

            tipsMessage += '🔍 尝试在以下路径查找:\n';
            const classPath = className.replace(/\./g, '/') + '.java';

            for (const basePath of searchPaths) {
                const fullPath = basePath + classPath;
                tipsMessage += `   • ${fullPath}\n`;
            }

            tipsMessage += '\n📁 当前工作区:\n';
            for (const folder of workspaceFolders) {
                tipsMessage += `   • ${path.basename(folder.uri.fsPath)}: ${folder.uri.fsPath}\n`;
            }
        }

        tipsMessage += '\n🎯 可能的原因:\n';
        tipsMessage += '   • 类文件不在标准的Java源码目录中\n';
        tipsMessage += '   • 包名与文件路径不匹配\n';
        tipsMessage += '   • 类名拼写错误\n';
        tipsMessage += '   • 文件尚未创建\n';

        const action = await vscode.window.showWarningMessage(
            `找不到类文件: ${className}`,
            {
                modal: true,
                detail: tipsMessage
            },
            '在工作区搜索',
            '创建文件',
            '显示详细提示'
        );

        if (action === '在工作区搜索') {
            await vscode.commands.executeCommand('workbench.action.findInFiles', {
                query: className.split('.').pop(),
                isRegex: false
            });
        } else if (action === '创建文件') {
            await this.createJavaFile(className);
        } else if (action === '显示详细提示') {
            await this.showDetailedTips(className);
        }
    }

    private async showDetailedTips(className: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        let detailMessage = `🔍 类文件查找详细信息\n\n`;
        detailMessage += `目标类: ${className}\n`;
        detailMessage += `简单类名: ${className.split('.').pop()}\n`;
        detailMessage += `包名: ${className.split('.').slice(0, -1).join('.')}\n\n`;

        if (workspaceFolders) {
            detailMessage += '📂 搜索路径详情:\n';

            for (const folder of workspaceFolders) {
                detailMessage += `\n工作区: ${folder.name}\n`;
                detailMessage += `路径: ${folder.uri.fsPath}\n`;

                const searchPaths = [
                    'src/main/java/',
                    'src/java/',
                    'src/',
                    ''
                ];

                for (const basePath of searchPaths) {
                    const classPath = className.replace(/\./g, '/') + '.java';
                    const fullPath = path.join(folder.uri.fsPath, basePath, classPath);

                    try {
                        await fs.promises.access(fullPath);
                        detailMessage += `   ✅ ${basePath}${classPath} (存在)\n`;
                    } catch {
                        detailMessage += `   ❌ ${basePath}${classPath} (不存在)\n`;
                    }
                }
            }
        }

        detailMessage += '\n🛠️ 解决方案:\n';
        detailMessage += '1. 确认类名和包名是否正确\n';
        detailMessage += '2. 检查文件是否在正确的源码目录中\n';
        detailMessage += '3. 使用"在工作区搜索"功能查找相似的文件\n';
        detailMessage += '4. 使用"创建文件"功能新建类文件\n';

        await vscode.window.showInformationMessage(
            '类文件查找详细信息',
            {
                modal: true,
                detail: detailMessage
            },
            '关闭'
        );
    }
}

export async function navigateToClass(args: { className: string }): Promise<void> {
    const xmlNav = new XmlNavigationCommands();
    await (xmlNav as any).navigateToClass(args.className);
}
