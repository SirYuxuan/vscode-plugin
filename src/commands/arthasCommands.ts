/**
 * Arthas命令模块
 * 实现Arthas相关的功能命令
 */

import * as vscode from 'vscode';
import { ArthasConfig, ConfigManager } from '../config';

/**
 * Arthas命令处理类
 * 主要功能：将Java源文件路径转换为对应的class文件路径
 */
export class ArthasCommands {
    private currentConfig: ArthasConfig;
    private configChangeListener?: vscode.Disposable;

    constructor() {
        this.currentConfig = ConfigManager.getArthasConfig();
        this.setupConfigListener();
    }

    /**
     * 设置配置变化监听器
     */
    private setupConfigListener(): void {
        this.configChangeListener = ConfigManager.onConfigurationChanged((newConfig) => {
            this.currentConfig = newConfig;
            console.log('Arthas配置已更新:', newConfig);
        });
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        this.configChangeListener?.dispose();
    }

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
            const action = await vscode.window.showInformationMessage(
                `Class路径已复制: ${classPath}`,
                { modal: false },
                '查看剪贴板',
                '更多操作'
            );

            // 处理用户点击的按钮
            await this.handleUserAction(action, classPath, currentFilePath);

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

        // 使用配置的基础路径
        const basePath = this.currentConfig.serverBasePath;

        // 构建完整路径: {serverBasePath}/classes/{package/ClassName.class}
        return `${basePath}/classes/${classPackagePath}`;
    }



    /**
     * 处理用户在消息框中点击的操作
     * @param action 用户选择的操作
     * @param classPath 生成的class路径
     * @param originalJavaPath 原始Java文件路径
     */
    private async handleUserAction(action: string | undefined, classPath: string, originalJavaPath?: string): Promise<void> {
        switch (action) {
            case '查看剪贴板':
                await this.showClipboardContent();
                break;
            case '更多操作':
                await this.showMoreActions(classPath, originalJavaPath);
                break;
            // 用户点击了消息框外部或关闭按钮，不做任何操作
        }
    }

    /**
     * 显示剪贴板内容
     */
    private async showClipboardContent(): Promise<void> {
        const clipboardText = await vscode.env.clipboard.readText();
        vscode.window.showInformationMessage(`剪贴板内容: ${clipboardText}`);
    }

    /**
     * 显示更多操作选项
     * @param classPath 生成的class文件路径
     * @param originalJavaPath 原始Java文件路径（可选）
     */
    private async showMoreActions(classPath: string, originalJavaPath?: string): Promise<void> {
        const actions = [
            '复制原始路径',
            '保存到文件',
            '显示路径信息',
            '查看配置',
            '打开设置'
        ];

        const selectedAction = await vscode.window.showQuickPick(actions, {
            placeHolder: '选择要执行的操作',
            title: `Class路径操作`
        });

        if (selectedAction) {
            await this.executeAction(selectedAction, classPath, originalJavaPath);
        }
    }

    /**
     * 执行具体的操作
     * @param action 选择的操作
     * @param classPath 生成的class文件路径
     * @param originalJavaPath 原始Java文件路径（可选）
     */
    private async executeAction(action: string, classPath: string, originalJavaPath?: string): Promise<void> {
        switch (action) {
            case '复制原始路径':
                if (originalJavaPath) {
                    await vscode.env.clipboard.writeText(originalJavaPath);
                    vscode.window.showInformationMessage(`原始Java路径已复制: ${originalJavaPath}`);
                } else {
                    vscode.window.showWarningMessage('原始Java路径不可用');
                }
                break;

            case '保存到文件':
                await this.savePathToFile(classPath, originalJavaPath);
                break;

            case '显示路径信息':
                await this.showPathInfo(classPath, originalJavaPath);
                break;

            case '查看配置':
                await this.showCurrentConfig();
                break;

            case '打开设置':
                await ConfigManager.openSettings();
                break;
        }
    }

    /**
     * 显示路径转换信息
     * @param classPath 生成的class文件路径
     * @param originalJavaPath 原始Java文件路径
     */
    private async showPathInfo(classPath: string, originalJavaPath?: string): Promise<void> {
        const pathInfo = [
            '📁 路径转换信息:',
            '',
            `📄 原始Java文件: ${originalJavaPath || '未知'}`,
            `🎯 目标Class路径: ${classPath}`,
            `⚙️  服务器基础路径: ${this.currentConfig.serverBasePath}`,
            '',
            '转换规则: src/main/java/**/*.java → {serverBasePath}/classes/**/*.class'
        ].join('\n');

        const action = await vscode.window.showInformationMessage(
            pathInfo,
            { modal: true },
            '复制Class路径',
            '复制Java路径',
            '关闭'
        );

        switch (action) {
            case '复制Class路径':
                await vscode.env.clipboard.writeText(classPath);
                vscode.window.showInformationMessage('Class路径已复制');
                break;
            case '复制Java路径':
                if (originalJavaPath) {
                    await vscode.env.clipboard.writeText(originalJavaPath);
                    vscode.window.showInformationMessage('Java路径已复制');
                }
                break;
        }
    }    /**
     * 显示当前配置
     */
    private async showCurrentConfig(): Promise<void> {
        const validation = ConfigManager.validateConfig(this.currentConfig);
        const statusIcon = validation.isValid ? '✅' : '❌';

        const configInfo = [
            `${statusIcon} 当前Arthas配置:`,
            `服务器地址: ${this.currentConfig.serverHost}:${this.currentConfig.serverPort}`,
            `基础路径: ${this.currentConfig.serverBasePath}`,
            validation.isValid ? '' : `\n❌ 配置错误:\n${validation.errors.join('\n')}`
        ].filter(line => line).join('\n');

        const buttons = ['复制配置', '关闭'];
        if (!validation.isValid) {
            buttons.unshift('打开设置');
        }

        const action = await vscode.window.showInformationMessage(
            configInfo,
            { modal: true },
            ...buttons
        );

        switch (action) {
            case '打开设置':
                await ConfigManager.openSettings();
                break;
            case '复制配置':
                await vscode.env.clipboard.writeText(JSON.stringify(this.currentConfig, null, 2));
                vscode.window.showInformationMessage('配置已复制到剪贴板');
                break;
        }
    }

    /**
     * 将路径信息保存到文件
     * @param classPath 生成的class文件路径
     * @param originalJavaPath 原始Java文件路径
     */
    private async savePathToFile(classPath: string, originalJavaPath?: string): Promise<void> {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('java-class-paths.txt'),
            filters: {
                '文本文件': ['txt'],
                '所有文件': ['*']
            }
        });

        if (uri) {
            const content = [
                '# Java to Class Path Conversion',
                `# Generated at ${new Date().toISOString()}`,
                '',
                `Original Java File: ${originalJavaPath || 'Unknown'}`,
                `Converted Class Path: ${classPath}`,
                `Server Base Path: ${this.currentConfig.serverBasePath}`,
                '',
                '# Conversion Rule:',
                '# src/main/java/**/*.java → {serverBasePath}/classes/**/*.class',
                ''
            ].join('\n');

            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage(`路径信息已保存到: ${uri.fsPath}`);
        }
    }
}