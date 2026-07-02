/**
 * Arthas 功能模块。
 *
 * 将当前编辑器中的 Java 源文件路径转换为 Arthas 可识别的 class 路径，
 * 并写入系统剪贴板，便于在 Arthas 中执行 `redefine` / `retransform` 等操作。
 */

import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { ConfigManager } from '../../core/config/configManager';
import { EXTENSION_ID } from '../../core/constants';
import { Logger } from '../../core/logging/logger';

export class CopyOfArthasCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.copyOfArthas`;

    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.scoped('Arthas');
    }

    public async execute(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;

            if (!activeEditor) {
                vscode.window.showWarningMessage('请先打开一个 Java 文件。');
                return;
            }

            const currentFilePath = activeEditor.document.uri.fsPath;

            if (!this.isJavaFile(currentFilePath)) {
                vscode.window.showWarningMessage('当前文件不是 Java 文件，请打开 .java 文件。');
                return;
            }

            const classPath = this.convertToClassPath(currentFilePath);

            if (!classPath) {
                vscode.window.showErrorMessage('无法解析 Java 文件路径，请确保文件在标准的 Maven/Gradle 项目结构中。');
                return;
            }

            await vscode.env.clipboard.writeText(classPath);
            this.logger.info('已复制 class 路径', classPath);
            vscode.window.showInformationMessage(`Class 路径已复制: ${classPath}`);
        } catch (error) {
            this.logger.error('转换文件路径出错', error);
            const message = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`转换文件路径时出错: ${message}`);
        }
    }

    private isJavaFile(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.java');
    }

    /**
     * 将 Java 源文件路径转换为 Arthas 的 class 路径。
     * 支持 `src/main/java/`（Maven）与 `src/java/` 两种结构；均未命中返回 `null`。
     */
    private convertToClassPath(javaFilePath: string): string | null {
        const markers = ['src/main/java/', 'src/java/'];

        for (const marker of markers) {
            const index = javaFilePath.indexOf(marker);

            if (index !== -1) {
                const packagePath = javaFilePath.substring(index + marker.length);
                return this.buildClassPath(packagePath);
            }
        }

        return null;
    }

    private buildClassPath(packagePath: string): string {
        const classPackagePath = packagePath.replace(/\.java$/, '.class');
        const { basePath } = ConfigManager.getArthasConfig();

        return `${basePath}/classes/${classPackagePath}`;
    }
}
