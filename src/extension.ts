/**
 * YuxuanPlugin - VS Code扩展主入口
 * 提供Arthas工具集成和其他实用功能
 */

import * as vscode from 'vscode';
import { CommandManager } from './commands';

/**
 * 扩展激活函数
 * 当扩展被激活时调用，负责初始化所有功能
 */
export function activate(context: vscode.ExtensionContext): void {
	console.log('YuxuanPlugin 扩展已激活');

	// 初始化命令管理器
	const commandManager = new CommandManager(context);

	// 注册所有命令
	commandManager.registerAll();

	console.log('YuxuanPlugin 所有功能已成功加载');
}

/**
 * 扩展停用函数
 * 当扩展被停用时调用，用于清理资源
 */
export function deactivate(): void {
	console.log('YuxuanPlugin 扩展已停用');
}
