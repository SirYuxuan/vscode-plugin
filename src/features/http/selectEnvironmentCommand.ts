/**
 * 「选择 HTTP 环境」命令。从 `.vscode/http-environments.json` 列出环境供切换。
 */

import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { EXTENSION_ID } from '../../core/constants';
import { Logger } from '../../core/logging/logger';
import { HttpEnvironment } from './httpEnvironment';

export class SelectEnvironmentCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.selectHttpEnvironment`;

    private static readonly NONE_LABEL = '（无环境）';

    private readonly logger: Logger;

    constructor(
        private readonly environment: HttpEnvironment,
        logger: Logger
    ) {
        this.logger = logger.scoped('HttpEnv');
    }

    public async execute(): Promise<void> {
        const environments = await this.environment.listEnvironments();

        if (environments.length === 0) {
            const create = '如何配置？';
            const choice = await vscode.window.showInformationMessage(
                '未找到环境配置。请在 .vscode/http-environments.json 中定义环境。',
                create
            );
            if (choice === create) {
                void vscode.env.openExternal(
                    vscode.Uri.parse('https://github.com/Huachao/vscode-restclient#environments')
                );
            }
            return;
        }

        const picked = await vscode.window.showQuickPick(
            [SelectEnvironmentCommand.NONE_LABEL, ...environments],
            { placeHolder: '选择 HTTP 环境' }
        );

        if (picked === undefined) {
            return;
        }

        const name = picked === SelectEnvironmentCommand.NONE_LABEL ? undefined : picked;
        await this.environment.setActive(name);
        this.logger.info('切换 HTTP 环境', name ?? '无');
        vscode.window.showInformationMessage(`HTTP 环境: ${name ?? '无'}`);
    }
}
