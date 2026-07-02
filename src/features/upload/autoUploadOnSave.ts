/**
 * 保存自动上传监听器。
 *
 * 当配置 `yuxuanplugin.upload.autoUploadOnSave` 打开时，保存位于受支持目录
 * 内的文件会自动触发上传。非命令，而是一个在扩展激活期间常驻的监听器。
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../../core/config/configManager';
import { Logger } from '../../core/logging/logger';
import { PathResolver } from '../../core/paths/pathResolver';
import { UploadCommand } from './uploadCommands';

export class AutoUploadOnSave implements vscode.Disposable {
    private readonly logger: Logger;
    private readonly subscription: vscode.Disposable;

    constructor(
        private readonly uploadCommand: UploadCommand,
        logger: Logger
    ) {
        this.logger = logger.scoped('AutoUpload');
        this.subscription = vscode.workspace.onDidSaveTextDocument((document) => this.onSave(document));
    }

    public dispose(): void {
        this.subscription.dispose();
    }

    private async onSave(document: vscode.TextDocument): Promise<void> {
        if (!ConfigManager.getUploadConfig().autoUploadOnSave) {
            return;
        }

        // 仅处理磁盘上的普通文件（排除输出面板、git diff 等虚拟文档）。
        if (document.uri.scheme !== 'file') {
            return;
        }

        const normalizedPath = PathResolver.normalize(document.uri.fsPath);

        if (!PathResolver.detectResourceKind(normalizedPath)) {
            return;
        }

        this.logger.debug('保存触发自动上传', normalizedPath);
        await this.uploadCommand.execute(document.uri);
    }
}
