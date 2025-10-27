/**
 * Arthas 功能模块
 * 提供将 Java 源文件路径转换成 Arthas 可识别的 class 路径。
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../../core/config/configManager';

export class ArthasCommands {
    /**
     * 将当前活动编辑器中的 Java 路径转换为 class 路径并写入剪贴板。
     */
    public async copyOfArthas(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;

            if (!activeEditor) {
                vscode.window.showWarningMessage('请先打开一个Java文件');
                return;
            }

            const currentFilePath = activeEditor.document.uri.fsPath;

            if (!this.isJavaFile(currentFilePath)) {
                vscode.window.showWarningMessage('当前文件不是Java文件，请打开.java文件');
                return;
            }

            const classPath = this.convertToClassPath(currentFilePath);

            if (!classPath) {
                vscode.window.showErrorMessage('无法解析Java文件路径，请确保文件在标准的Maven/Gradle项目结构中');
                return;
            }

            await vscode.env.clipboard.writeText(classPath);
            vscode.window.showInformationMessage(`Class路径已复制: ${classPath}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`转换文件路径时出错: ${errorMessage}`);
        }
    }

    private isJavaFile(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.java');
    }

    private convertToClassPath(javaFilePath: string): string | null {
        try {
            const srcMainJavaIndex = javaFilePath.indexOf('src/main/java/');

            if (srcMainJavaIndex === -1) {
                const srcJavaIndex = javaFilePath.indexOf('src/java/');
                if (srcJavaIndex === -1) {
                    return null;
                }

                const packagePath = javaFilePath.substring(srcJavaIndex + 'src/java/'.length);
                return this.buildClassPath(packagePath);
            }

            const packagePath = javaFilePath.substring(srcMainJavaIndex + 'src/main/java/'.length);
            return this.buildClassPath(packagePath);
        } catch (error) {
            console.error('转换路径时出错:', error);
            return null;
        }
    }

    private buildClassPath(packagePath: string): string {
        const classPackagePath = packagePath.replace(/\.java$/, '.class');
        const config = ConfigManager.getArthasConfig();

        return `${config.basePath}/classes/${classPackagePath}`;
    }
}
