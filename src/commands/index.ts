/**
 * 命令模块 - 统一管理所有命令
 * 提供命令注册和执行的统一入口
 */

import * as vscode from 'vscode';
import { ArthasCommands } from './arthasCommands';
import { XmlJavaClassLinkProvider } from './xmlNavigationCommands';

/**
 * 命令管理器类
 * 负责注册和管理所有扩展命令
 */
export class CommandManager {
    private readonly arthasCommands: ArthasCommands;
    private readonly xmlJavaClassLinkProvider: XmlJavaClassLinkProvider;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.arthasCommands = new ArthasCommands();
        this.xmlJavaClassLinkProvider = new XmlJavaClassLinkProvider();
    }

    /**
     * 注册所有命令
     * 将命令注册到VS Code扩展上下文中
     */
    public registerAll(): void {
        this.registerArthasCommands();
        this.registerXmlDocumentLinkProvider();
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
     * 注册XML文档链接提供者
     */
    private registerXmlDocumentLinkProvider(): void {
        // 注册XML文档链接提供者，用于在XML文件中显示Java类的超链接
        const xmlLinkProvider = vscode.languages.registerDocumentLinkProvider(
            { scheme: 'file', language: 'xml' },
            this.xmlJavaClassLinkProvider
        );

        this.context.subscriptions.push(xmlLinkProvider);
    }
}