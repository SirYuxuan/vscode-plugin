/**
 * HTTP 环境管理。
 *
 * 从工作区 `.vscode/http-environments.json` 读取多套环境变量：
 * ```json
 * { "dev": { "base": "http://localhost:8080" }, "prod": { "base": "https://api.example.com" } }
 * ```
 * 当前激活环境存于 workspaceState，并在状态栏显示（仅在编辑 `.http` 文件时出现）。
 */

import * as vscode from 'vscode';
import { EXTENSION_ID } from '../../core/constants';
import { Logger } from '../../core/logging/logger';

type EnvironmentMap = Record<string, Record<string, string>>;

export class HttpEnvironment implements vscode.Disposable {
    private static readonly STATE_KEY = `${EXTENSION_ID}.httpActiveEnv`;
    private static readonly ENV_FILE = ['.vscode', 'http-environments.json'];

    private readonly logger: Logger;
    private readonly statusBar: vscode.StatusBarItem;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(
        private readonly state: vscode.Memento,
        logger: Logger
    ) {
        this.logger = logger.scoped('HttpEnv');

        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
        this.statusBar.command = `${EXTENSION_ID}.selectHttpEnvironment`;
        this.statusBar.tooltip = '切换 HTTP 环境';
        this.updateStatusBar();

        this.disposables.push(
            this.statusBar,
            vscode.window.onDidChangeActiveTextEditor(() => this.syncStatusBarVisibility())
        );
        this.syncStatusBarVisibility();
    }

    /** 当前激活环境名（未选则 undefined）。 */
    public get active(): string | undefined {
        return this.state.get<string>(HttpEnvironment.STATE_KEY);
    }

    /** 设置激活环境。 */
    public async setActive(name: string | undefined): Promise<void> {
        await this.state.update(HttpEnvironment.STATE_KEY, name);
        this.updateStatusBar();
    }

    /** 列出所有可用环境名。 */
    public async listEnvironments(): Promise<string[]> {
        return Object.keys(await this.loadFile());
    }

    /** 获取当前激活环境的变量表；无激活环境时返回空表。 */
    public async getActiveVars(): Promise<Record<string, string>> {
        const name = this.active;
        if (!name) {
            return {};
        }

        const map = await this.loadFile();
        return map[name] ?? {};
    }

    public dispose(): void {
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }

    private async loadFile(): Promise<EnvironmentMap> {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return {};
        }

        const uri = vscode.Uri.joinPath(folders[0].uri, ...HttpEnvironment.ENV_FILE);
        try {
            const buffer = await vscode.workspace.fs.readFile(uri);
            return JSON.parse(Buffer.from(buffer).toString('utf8')) as EnvironmentMap;
        } catch (error) {
            this.logger.debug('未读取到环境文件', error);
            return {};
        }
    }

    private updateStatusBar(): void {
        this.statusBar.text = `$(globe) HTTP: ${this.active ?? '无环境'}`;
    }

    /** 仅当活动编辑器是 .http 文件时显示状态栏，避免打扰其他场景。 */
    private syncStatusBarVisibility(): void {
        const fileName = vscode.window.activeTextEditor?.document.fileName ?? '';
        if (fileName.toLowerCase().endsWith('.http') || fileName.toLowerCase().endsWith('.rest')) {
            this.statusBar.show();
        } else {
            this.statusBar.hide();
        }
    }
}
