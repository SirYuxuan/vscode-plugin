/**
 * 基于操作历史的便捷命令：重传上次文件、查看并重放上传历史。
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { EXTENSION_ID } from '../../core/constants';
import { OperationHistory, OperationRecord } from '../../core/history/operationHistory';
import { Logger } from '../../core/logging/logger';
import { UploadCommand } from './uploadCommands';

/**
 * 「重新上传上次文件」。直接复用最近一次上传记录的路径再次上传。
 */
export class UploadLastCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.uploadLast`;

    private readonly logger: Logger;

    constructor(
        private readonly uploadCommand: UploadCommand,
        private readonly history: OperationHistory,
        logger: Logger
    ) {
        this.logger = logger.scoped('UploadLast');
    }

    public async execute(): Promise<void> {
        const last = this.history.getLast('upload');

        if (!last) {
            vscode.window.showInformationMessage('暂无上传历史。');
            return;
        }

        this.logger.info('重新上传上次文件', last.fsPath);
        await this.uploadCommand.execute(vscode.Uri.file(last.fsPath));
    }
}

/**
 * 「上传历史」。以 QuickPick 展示最近操作，选中后重新上传对应资源。
 */
export class ShowHistoryCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.showUploadHistory`;

    private readonly logger: Logger;

    constructor(
        private readonly uploadCommand: UploadCommand,
        private readonly history: OperationHistory,
        logger: Logger
    ) {
        this.logger = logger.scoped('History');
    }

    public async execute(): Promise<void> {
        const records = this.history.getAll();

        if (records.length === 0) {
            vscode.window.showInformationMessage('暂无操作历史。');
            return;
        }

        const picked = await vscode.window.showQuickPick(
            records.map((record) => this.toQuickPickItem(record)),
            { placeHolder: '选择一条记录以重新上传该资源' }
        );

        if (picked) {
            this.logger.info('从历史重新上传', picked.record.fsPath);
            await this.uploadCommand.execute(vscode.Uri.file(picked.record.fsPath));
        }
    }

    private toQuickPickItem(record: OperationRecord): vscode.QuickPickItem & { record: OperationRecord } {
        const action = record.type === 'upload' ? '上传' : '删除';
        const time = new Date(record.timestamp).toLocaleString();

        return {
            label: `$(history) ${path.basename(record.fsPath)}`,
            description: `${action} · ${time}`,
            detail: record.fsPath,
            record
        };
    }
}
