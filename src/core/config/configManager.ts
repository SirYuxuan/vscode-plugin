import * as vscode from 'vscode';
import { EXTENSION_ID } from '../constants';

/** Arthas 相关配置。 */
export interface ArthasConfig {
    /** Arthas 在服务器上的基础目录，用于拼接 class 路径。 */
    basePath: string;
}

/** 远程服务器（SFTP）连接与项目路径配置。 */
export interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    /** 服务器上部署项目的根目录。 */
    projectPath: string;
}

/** 上传行为相关配置。 */
export interface UploadConfig {
    /** 保存受支持的文件时是否自动上传。 */
    autoUploadOnSave: boolean;
}

/** HTTP 测试台相关配置。 */
export interface HttpConfig {
    /** 请求超时时间（毫秒）。 */
    timeout: number;
}

/**
 * 配置读取入口。
 *
 * 统一封装对 `vscode.workspace.getConfiguration` 的访问，向业务层提供
 * 强类型的配置对象与校验方法，避免各处硬编码配置键名与默认值。
 */
export class ConfigManager {
    private static readonly ARTHAS_SECTION = 'arthas';
    private static readonly SERVER_SECTION = 'server';
    private static readonly UPLOAD_SECTION = 'upload';
    private static readonly HTTP_SECTION = 'http';

    /** 默认值集中定义，保持与 package.json 中的声明一致。 */
    private static readonly DEFAULTS = {
        arthasBasePath: '/opt/arthas',
        serverHost: '127.0.0.1',
        serverPort: 22,
        projectPath: '/opt/project'
    } as const;

    public static getArthasConfig(): ArthasConfig {
        const config = vscode.workspace.getConfiguration(EXTENSION_ID);

        return {
            basePath: this.normalizeBasePath(
                config.get<string>(`${this.ARTHAS_SECTION}.basePath`, this.DEFAULTS.arthasBasePath)
            )
        };
    }

    public static getServerConfig(): ServerConfig {
        const config = vscode.workspace.getConfiguration(EXTENSION_ID);

        return {
            host: config.get<string>(`${this.SERVER_SECTION}.host`, this.DEFAULTS.serverHost),
            port: config.get<number>(`${this.SERVER_SECTION}.port`, this.DEFAULTS.serverPort),
            username: config.get<string>(`${this.SERVER_SECTION}.username`, ''),
            password: config.get<string>(`${this.SERVER_SECTION}.password`, ''),
            projectPath: config.get<string>(`${this.SERVER_SECTION}.projectPath`, this.DEFAULTS.projectPath)
        };
    }

    public static getUploadConfig(): UploadConfig {
        const config = vscode.workspace.getConfiguration(EXTENSION_ID);

        return {
            autoUploadOnSave: config.get<boolean>(`${this.UPLOAD_SECTION}.autoUploadOnSave`, false)
        };
    }

    public static getHttpConfig(): HttpConfig {
        const config = vscode.workspace.getConfiguration(EXTENSION_ID);

        return {
            timeout: config.get<number>(`${this.HTTP_SECTION}.timeout`, 30000)
        };
    }

    /**
     * 校验服务器配置是否可用于建立连接。
     * @returns 校验失败时返回给用户的提示信息；通过则返回 `undefined`。
     */
    public static validateServerConfig(config: ServerConfig): string | undefined {
        if (!config.host) {
            return '请先在设置中配置服务器主机地址。';
        }

        if (!config.username) {
            return '请先在设置中配置服务器登录账号。';
        }

        if (!config.password) {
            return '请先在设置中配置服务器登录密码。';
        }

        if (!config.projectPath) {
            return '请先在设置中配置服务器项目路径。';
        }

        return undefined;
    }

    /** 打开本扩展的设置页面，可选定位到某个配置节点。 */
    public static async openSettings(section?: string): Promise<void> {
        const query = section ? `@ext:${EXTENSION_ID} ${section}` : `@ext:${EXTENSION_ID}`;
        await vscode.commands.executeCommand('workbench.action.openSettings', query);
    }

    /** 规范化 Arthas 基础路径：去尾部斜杠、补全前导斜杠（兼容 Windows 盘符）。 */
    private static normalizeBasePath(basePath: string): string {
        if (!basePath) {
            return this.DEFAULTS.arthasBasePath;
        }

        let normalized = basePath.trim().replace(/\/+$/, '');

        if (!normalized.startsWith('/') && !normalized.match(/^[A-Za-z]:/)) {
            normalized = '/' + normalized;
        }

        return normalized;
    }
}
