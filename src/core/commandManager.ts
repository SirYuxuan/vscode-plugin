/**
 * 统一注册扩展内的命令与提供者，便于集中管理与扩展。
 */

import * as vscode from 'vscode';
import { ArthasCommands } from '../features/arthas/arthasCommands';
import { UploadCommands } from '../features/upload/uploadCommands';
import { XmlJavaClassLinkProvider } from '../features/xml/xmlLinkProvider';

export class CommandManager {
    private readonly arthasCommands: ArthasCommands;
    private readonly xmlJavaClassLinkProvider: XmlJavaClassLinkProvider;
    private readonly uploadCommands: UploadCommands;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.arthasCommands = new ArthasCommands();
        this.xmlJavaClassLinkProvider = new XmlJavaClassLinkProvider();
        this.uploadCommands = new UploadCommands();
        this.context.subscriptions.push(this.uploadCommands);
    }

    public registerAll(): void {
        this.registerArthasCommands();
        this.registerUploadCommands();
        this.registerXmlDocumentLinkProvider();
    }

    private registerArthasCommands(): void {
        const copyOfArthasCommand = vscode.commands.registerCommand(
            'yuxuanplugin.copyOfArthas',
            () => this.arthasCommands.copyOfArthas()
        );

        this.context.subscriptions.push(copyOfArthasCommand);
    }

    private registerUploadCommands(): void {
        const uploadCommand = vscode.commands.registerCommand(
            'yuxuanplugin.upload',
            (target: vscode.Uri) => this.uploadCommands.upload(target)
        );

        const deleteCommand = vscode.commands.registerCommand(
            'yuxuanplugin.delete',
            (target: vscode.Uri) => this.uploadCommands.delete(target)
        );

        const findClassCommand = vscode.commands.registerCommand(
            'yuxuanplugin.findClass',
            (target: vscode.Uri) => this.uploadCommands.findClass(target)
        );

        this.context.subscriptions.push(uploadCommand);
        this.context.subscriptions.push(deleteCommand);
        this.context.subscriptions.push(findClassCommand);
    }

    private registerXmlDocumentLinkProvider(): void {
        const xmlLinkProvider = vscode.languages.registerDocumentLinkProvider(
            { scheme: 'file', pattern: '**/*.xml' },
            this.xmlJavaClassLinkProvider
        );

        this.context.subscriptions.push(xmlLinkProvider);
    }
}
