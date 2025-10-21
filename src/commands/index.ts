/**
 * 命令模块 - 统一管理所有命令
 * 提供命令注册和执行的统一入口
 */

import * as vscode from 'vscode';
import { ArthasCommands } from './arthasCommands';
import { XmlNavigationCommands, navigateToClass } from './xmlNavigationCommands';

/**
 * 命令管理器类
 * 负责注册和管理所有扩展命令
 */
export class CommandManager {
    private readonly arthasCommands: ArthasCommands;
    private readonly xmlNavigationCommands: XmlNavigationCommands;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.arthasCommands = new ArthasCommands();
        this.xmlNavigationCommands = new XmlNavigationCommands();
    }

    /**
     * 注册所有命令
     * 将命令注册到VS Code扩展上下文中
     */
    public registerAll(): void {
        this.registerArthasCommands();
        this.registerXmlNavigationCommands();
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

    /**
     * 注册XML导航相关命令
     */
    private registerXmlNavigationCommands(): void {
        // 注册跳转到Java类的命令
        const jumpToJavaClassCommand = vscode.commands.registerCommand(
            'yuxuanplugin.jumpToJavaClass',
            () => this.xmlNavigationCommands.jumpToJavaClass()
        );

        // 注册导航到类的命令
        const navigateToClassCommand = vscode.commands.registerCommand(
            'yuxuanplugin.navigateToClass',
            navigateToClass
        );

        this.context.subscriptions.push(jumpToJavaClassCommand, navigateToClassCommand);
    }
}