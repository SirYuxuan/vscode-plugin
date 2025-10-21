/**
 * Arthas命令模块
 * 实现Arthas相关的功能命令
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../config';

/**
 * Arthas命令处理类
 * 主要功能：将Java源文件路径转换为对应的class文件路径
 */
export class ArthasCommands {

    /**
     * Copy of Arthas命令处理函数
     * 将当前Java源文件路径转换为对应的class文件路径并复制到剪贴板
     */
    public async copyOfArthas(): Promise<void> {
        try {
            // 获取当前活动编辑器
            const activeEditor = vscode.window.activeTextEditor;

            if (!activeEditor) {
                vscode.window.showWarningMessage('请先打开一个Java文件');
                return;
            }

            const currentFilePath = activeEditor.document.uri.fsPath;

            // 检查是否为Java文件
            if (!this.isJavaFile(currentFilePath)) {
                vscode.window.showWarningMessage('当前文件不是Java文件，请打开.java文件');
                return;
            }

            // 转换为class文件路径
            const classPath = this.convertToClassPath(currentFilePath);

            if (!classPath) {
                vscode.window.showErrorMessage('无法解析Java文件路径，请确保文件在标准的Maven/Gradle项目结构中');
                return;
            }

            // 复制到剪贴板
            await vscode.env.clipboard.writeText(classPath);

            // 显示成功消息
            vscode.window.showInformationMessage(`Class路径已复制: ${classPath}`);

        } catch (error) {
            // 错误处理
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`转换文件路径时出错: ${errorMessage}`);
        }
    }

    /**
     * 检查文件是否为Java文件
     * @param filePath 文件路径
     * @returns 是否为Java文件
     */
    private isJavaFile(filePath: string): boolean {
        return filePath.toLowerCase().endsWith('.java');
    }

    /**
     * 将Java源文件路径转换为class文件路径
     * @param javaFilePath Java源文件路径
     * @returns 转换后的class文件路径，失败返回null
     */
    private convertToClassPath(javaFilePath: string): string | null {
        try {
            // 查找src/main/java路径
            const srcMainJavaIndex = javaFilePath.indexOf('src/main/java/');

            if (srcMainJavaIndex === -1) {
                // 如果没找到标准路径，尝试查找src/java/
                const srcJavaIndex = javaFilePath.indexOf('src/java/');
                if (srcJavaIndex === -1) {
                    return null;
                }

                // 提取包路径部分
                const packagePath = javaFilePath.substring(srcJavaIndex + 'src/java/'.length);
                return this.buildClassPath(packagePath);
            }

            // 提取包路径部分 (src/main/java/ 之后的部分)
            const packagePath = javaFilePath.substring(srcMainJavaIndex + 'src/main/java/'.length);
            return this.buildClassPath(packagePath);

        } catch (error) {
            console.error('转换路径时出错:', error);
            return null;
        }
    }

    /**
     * 构建最终的class文件路径
     * @param packagePath 包路径（包含文件名）
     * @returns 完整的class文件路径
     */
    private buildClassPath(packagePath: string): string {
        // 将.java后缀替换为.class
        const classPackagePath = packagePath.replace(/\.java$/, '.class');

        // 获取配置的基础路径
        const config = ConfigManager.getArthasConfig();
        const basePath = config.basePath;

        // 构建完整路径: {basePath}/classes/{package/ClassName.class}
        return `${basePath}/classes/${classPackagePath}`;
    }
}