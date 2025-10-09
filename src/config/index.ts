/**
 * 配置管理模块
 * 统一管理扩展的所有配置项
 */

import * as vscode from 'vscode';

/**
 * Arthas配置接口
 */
export interface ArthasConfig {
    serverBasePath: string;
    serverHost: string;
    serverPort: number;
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
            serverBasePath: this.normalizeBasePath(
                config.get<string>(`${this.CONFIG_SECTION}.serverBasePath`, '/opt/arthas')
            ),
            serverHost: config.get<string>(`${this.CONFIG_SECTION}.serverHost`, 'localhost'),
            serverPort: config.get<number>(`${this.CONFIG_SECTION}.serverPort`, 3658)
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

        return `${arthasConfig.serverBasePath}/${cleanRelativePath}`;
    }

    /**
     * 构建服务器地址
     * @param config 可选的配置对象，不提供则使用当前配置
     * @returns 服务器地址字符串
     */
    public static buildServerAddress(config?: ArthasConfig): string {
        const arthasConfig = config || this.getArthasConfig();
        return `${arthasConfig.serverHost}:${arthasConfig.serverPort}`;
    }

    /**
     * 验证配置的有效性
     * @param config 要验证的配置
     * @returns 验证结果，包含是否有效和错误消息
     */
    public static validateConfig(config: ArthasConfig): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 验证基础路径
        if (!config.serverBasePath || config.serverBasePath.trim().length === 0) {
            errors.push('服务器基础路径不能为空');
        }

        // 验证主机地址
        if (!config.serverHost || config.serverHost.trim().length === 0) {
            errors.push('服务器主机地址不能为空');
        } else {
            // 简单的主机名/IP验证
            const hostPattern = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
            if (!hostPattern.test(config.serverHost.trim())) {
                errors.push('服务器主机地址格式无效');
            }
        }

        // 验证端口号
        if (!Number.isInteger(config.serverPort) || config.serverPort < 1 || config.serverPort > 65535) {
            errors.push('端口号必须是1-65535之间的整数');
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