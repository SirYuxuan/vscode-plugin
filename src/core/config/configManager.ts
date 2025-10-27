import * as vscode from 'vscode';

export interface ArthasConfig {
    basePath: string;
}

export interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    projectPath: string;
}

/**
 * 管理扩展的配置项，提供统一的读取、验证和监听入口。
 */
export class ConfigManager {
    private static readonly EXTENSION_NAME = 'yuxuanplugin';
    private static readonly ARTHAS_SECTION = 'arthas';
    private static readonly SERVER_SECTION = 'server';

    public static getArthasConfig(): ArthasConfig {
        const config = vscode.workspace.getConfiguration(this.EXTENSION_NAME);

        return {
            basePath: this.normalizeBasePath(
                config.get<string>(`${this.ARTHAS_SECTION}.basePath`, '/opt/arthas')
            )
        };
    }

    public static getServerConfig(): ServerConfig {
        const config = vscode.workspace.getConfiguration(this.EXTENSION_NAME);

        return {
            host: config.get<string>(`${this.SERVER_SECTION}.host`, '127.0.0.1'),
            port: config.get<number>(`${this.SERVER_SECTION}.port`, 22),
            username: config.get<string>(`${this.SERVER_SECTION}.username`, ''),
            password: config.get<string>(`${this.SERVER_SECTION}.password`, ''),
            projectPath: config.get<string>(`${this.SERVER_SECTION}.projectPath`, '/opt/project')
        };
    }

    private static normalizeBasePath(basePath: string): string {
        if (!basePath) {
            return '/opt/arthas';
        }

        let normalized = basePath.trim().replace(/\/+$/, '');

        if (!normalized.startsWith('/') && !normalized.match(/^[A-Za-z]:/)) {
            normalized = '/' + normalized;
        }

        return normalized;
    }

    public static buildFullPath(relativePath: string, config?: ArthasConfig): string {
        const arthasConfig = config || this.getArthasConfig();
        const cleanRelativePath = relativePath.replace(/^\/+/, '');

        return `${arthasConfig.basePath}/${cleanRelativePath}`;
    }

    public static validateConfig(config: ArthasConfig): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!config.basePath || config.basePath.trim().length === 0) {
            errors.push('Arthas基础路径不能为空');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    public static onConfigurationChanged(
        callback: (newConfig: ArthasConfig) => void
    ): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(`${this.EXTENSION_NAME}.${this.ARTHAS_SECTION}`)) {
                const newConfig = this.getArthasConfig();
                callback(newConfig);
            }
        });
    }

    public static async openSettings(): Promise<void> {
        await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            `@ext:yuxuanplugin ${this.ARTHAS_SECTION}`
        );
    }
}
