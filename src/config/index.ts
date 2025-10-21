/**
 * 配置管理模块
 * 统一管理扩展的所有配置项
 */

import * as vscode from 'vscode';

/**
 * Arthas配置接口
 */
export interface ArthasConfig {
    basePath: string;
}

/**
 * 配置管理器类
 * 提供配置的读取、验证和监听功能
 */
export class ConfigManager {
    private static readonly EXTENSION_NAME = 'yuxuanplugin';
    private static readonly CONFIG_SECTION = 'arthas';

    /**
     * 获取Arthas相关配置
     * @returns Arthas配置对象
     */
    public static getArthasConfig(): ArthasConfig {
        const config = vscode.workspace.getConfiguration(this.EXTENSION_NAME);

        return {
            basePath: this.normalizeBasePath(
                config.get<string>(`${this.CONFIG_SECTION}.basePath`, '/opt/arthas')
            )
        };
    }

    /**
     * 规范化基础路径
     * 确保路径格式的一致性
     * @param basePath 原始基础路径
     * @returns 规范化后的路径
     */
    private static normalizeBasePath(basePath: string): string {
        if (!basePath) {
            return '/opt/arthas';
        }

        // 去除末尾的斜杠
        let normalized = basePath.trim().replace(/\/+$/, '');

        // 确保以斜杠开头（Unix/Linux路径）
        if (!normalized.startsWith('/') && !normalized.match(/^[A-Za-z]:/)) {
            normalized = '/' + normalized;
        }

        return normalized;
    }

    /**
     * 构建完整的文件路径
     * @param relativePath 相对路径
     * @param config 可选的配置对象，不提供则使用当前配置
     * @returns 完整的文件路径
     */
    public static buildFullPath(relativePath: string, config?: ArthasConfig): string {
        const arthasConfig = config || this.getArthasConfig();
        const cleanRelativePath = relativePath.replace(/^\/+/, ''); // 移除开头的斜杠

        return `${arthasConfig.basePath}/${cleanRelativePath}`;
    }

    /**
     * 验证配置的有效性
     * @param config 要验证的配置
     * @returns 验证结果，包含是否有效和错误消息
     */
    public static validateConfig(config: ArthasConfig): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 验证基础路径
        if (!config.basePath || config.basePath.trim().length === 0) {
            errors.push('Arthas基础路径不能为空');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 监听配置变化
     * @param callback 配置变化时的回调函数
     * @returns 可用于取消监听的Disposable对象
     */
    public static onConfigurationChanged(
        callback: (newConfig: ArthasConfig) => void
    ): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(`${this.EXTENSION_NAME}.${this.CONFIG_SECTION}`)) {
                const newConfig = this.getArthasConfig();
                callback(newConfig);
            }
        });
    }

    /**
     * 打开配置设置页面
     */
    public static async openSettings(): Promise<void> {
        await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            `@ext:yuxuanplugin ${this.CONFIG_SECTION}`
        );
    }
}