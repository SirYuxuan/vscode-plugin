/**
 * 命令模块 - 统一管理所有命令
 * 提供命令注册和执行的统一入口
 */

import * as vscode from 'vscode';
import { ArthasCommands } from './arthasCommands';

/**
 * 命令管理器类
 * 负责注册和管理所有扩展命令
 */
export class CommandManager {
    private readonly arthasCommands: ArthasCommands;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.arthasCommands = new ArthasCommands();

        // 注册资源释放
        this.context.subscriptions.push({
            dispose: () => this.arthasCommands.dispose()
        });
    }

    /**
     * 注册所有命令
     * 将命令注册到VS Code扩展上下文中
     */
    public registerAll(): void {
        this.registerArthasCommands();
    }

    /**
     * 注册Arthas相关命令
     */
    private registerArthasCommands(): void {
        const copyOfArthasCommand = vscode.commands.registerCommand(
            'yuxuanplugin.copyOfArthas',
            () => this.arthasCommands.copyOfArthas()
        );

        this.context.subscriptions.push(copyOfArthasCommand);
    }
}