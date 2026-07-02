/**
 * 扩展的组装根（Composition Root）。
 *
 * 在此集中构建共享依赖（Logger、SftpService、历史、Java 解析器、HTTP 环境等），
 * 装配所有命令贡献点、语言提供者与监听器，并统一注册到 VS Code。新增命令时，
 * 只需实现 {@link CommandContribution} 并加入 {@link createCommands} 的返回列表即可，
 * 无需改动注册逻辑。
 */

import * as vscode from 'vscode';
import { CommandContribution } from './command';
import { OperationHistory } from './history/operationHistory';
import { JavaClassResolver } from './java/javaClassResolver';
import { Logger } from './logging/logger';
import { SftpService } from './sftp/sftpService';
import { CopyOfArthasCommand } from '../features/arthas/arthasCommands';
import { FindClassCommand } from '../features/findClass/findClassCommand';
import { HttpCodeLensProvider } from '../features/http/httpCodeLensProvider';
import { HttpEnvironment } from '../features/http/httpEnvironment';
import { SelectEnvironmentCommand } from '../features/http/selectEnvironmentCommand';
import { SendRequestCommand } from '../features/http/sendRequestCommand';
import { OpenToolbenchCommand } from '../features/toolbench/openToolbenchCommand';
import { AutoUploadOnSave } from '../features/upload/autoUploadOnSave';
import { ShowHistoryCommand, UploadLastCommand } from '../features/upload/historyCommands';
import { DeleteCommand, UploadCommand } from '../features/upload/uploadCommands';
import { FindXmlReferencesCommand } from '../features/xml/findXmlReferencesCommand';
import { XmlJavaClassHoverProvider } from '../features/xml/xmlHoverProvider';
import { XmlJavaClassLinkProvider } from '../features/xml/xmlLinkProvider';

export class CommandManager {
    private readonly logger: Logger;
    private readonly sftp: SftpService;
    private readonly history: OperationHistory;
    private readonly javaResolver: JavaClassResolver;
    private readonly httpEnvironment: HttpEnvironment;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.logger = Logger.shared;
        this.sftp = new SftpService(this.logger);
        this.history = new OperationHistory(context.workspaceState);
        this.javaResolver = new JavaClassResolver(this.logger);
        this.httpEnvironment = new HttpEnvironment(context.workspaceState, this.logger);

        // 需要显式释放的资源统一登记到 subscriptions。
        this.context.subscriptions.push(this.logger, this.javaResolver, this.httpEnvironment);
    }

    /** 注册全部命令、语言提供者与监听器。 */
    public registerAll(): void {
        this.registerCommands();
        this.registerLanguageProviders();
        this.registerListeners();
    }

    /** 构建所有命令贡献点。新增功能时在此登记即可。 */
    private createCommands(): CommandContribution[] {
        // upload 命令被 uploadLast / showHistory / 自动上传复用，先单独构造。
        const upload = new UploadCommand(this.sftp, this.history, this.logger);
        const extensionUri = this.context.extensionUri;

        return [
            new CopyOfArthasCommand(this.logger),
            new FindClassCommand(this.logger),
            upload,
            new DeleteCommand(this.sftp, this.history, this.logger),
            new UploadLastCommand(upload, this.history, this.logger),
            new ShowHistoryCommand(upload, this.history, this.logger),
            new FindXmlReferencesCommand(this.logger),
            new OpenToolbenchCommand(extensionUri, this.logger),
            new SendRequestCommand(extensionUri, this.httpEnvironment, this.logger),
            new SelectEnvironmentCommand(this.httpEnvironment, this.logger)
        ];
    }

    private registerCommands(): void {
        for (const command of this.createCommands()) {
            const disposable = vscode.commands.registerCommand(command.id, (...args: unknown[]) =>
                command.execute(...args)
            );
            this.context.subscriptions.push(disposable);
        }
    }

    private registerLanguageProviders(): void {
        const xmlSelector: vscode.DocumentSelector = { scheme: 'file', pattern: '**/*.xml' };
        const httpSelector: vscode.DocumentSelector = { scheme: 'file', pattern: '**/*.http' };

        this.context.subscriptions.push(
            vscode.languages.registerDocumentLinkProvider(
                xmlSelector,
                new XmlJavaClassLinkProvider(this.javaResolver, this.logger)
            ),
            vscode.languages.registerHoverProvider(
                xmlSelector,
                new XmlJavaClassHoverProvider(this.javaResolver, this.logger)
            ),
            vscode.languages.registerCodeLensProvider(httpSelector, new HttpCodeLensProvider())
        );
    }

    private registerListeners(): void {
        // 保存自动上传复用与命令列表中同一逻辑的独立 UploadCommand 实例即可。
        const upload = new UploadCommand(this.sftp, this.history, this.logger);
        this.context.subscriptions.push(new AutoUploadOnSave(upload, this.logger));
    }
}
