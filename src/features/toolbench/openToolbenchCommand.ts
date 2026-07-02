import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { EXTENSION_ID } from '../../core/constants';
import { Logger } from '../../core/logging/logger';
import { ToolbenchPanel } from './toolbenchPanel';

/** 打开开发者工具台的命令。 */
export class OpenToolbenchCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.openToolbench`;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly logger: Logger
    ) {}

    public execute(): void {
        ToolbenchPanel.show(this.extensionUri, this.logger);
    }
}
