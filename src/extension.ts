/**
 * Yuxuan Dev Assistant —— VS Code 扩展主入口。
 *
 * 仅负责生命周期钩子；具体功能的装配与注册委托给 {@link CommandManager}。
 */

import * as vscode from 'vscode';
import { CommandManager } from './core/commandManager';
import { Logger } from './core/logging/logger';

/** 扩展激活：初始化命令管理器并注册全部功能。 */
export function activate(context: vscode.ExtensionContext): void {
    const logger = Logger.shared;
    logger.info('Yuxuan Dev Assistant 扩展已激活');

    new CommandManager(context).registerAll();

    logger.info('Yuxuan Dev Assistant 所有功能已成功加载');
}

/** 扩展停用：资源通过 context.subscriptions 自动释放，这里仅记录日志。 */
export function deactivate(): void {
    Logger.shared.info('Yuxuan Dev Assistant 扩展已停用');
}
