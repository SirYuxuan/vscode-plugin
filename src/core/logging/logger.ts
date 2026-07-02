import * as vscode from 'vscode';

/** 日志级别，由低到高。 */
export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3
}

/**
 * 统一的日志封装，基于单个 {@link vscode.OutputChannel}。
 *
 * 设计目标：
 * - 全扩展共用同一个输出面板（"Yuxuan Dev Assistant"），替代散落的 `console.log`；
 * - 支持带模块前缀的子 Logger（{@link scoped}），方便定位日志来源；
 * - 统一格式化任意附加数据（字符串 / Error / 对象）。
 *
 * 通常通过 {@link Logger.shared} 获取全局实例，再调用 {@link scoped} 派生模块 logger。
 */
export class Logger implements vscode.Disposable {
    private static instance: Logger | undefined;

    private readonly channel: vscode.OutputChannel;

    private constructor(
        channelName: string,
        private readonly scope: string,
        private minLevel: LogLevel,
        channel?: vscode.OutputChannel
    ) {
        // 子 logger 复用父级的 channel，避免创建多个输出面板。
        this.channel = channel ?? vscode.window.createOutputChannel(channelName);
    }

    /** 获取全局共享 Logger（首次调用时创建输出面板）。 */
    public static get shared(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger('Yuxuan Dev Assistant', '', LogLevel.Info);
        }

        return Logger.instance;
    }

    /** 派生一个带模块前缀的子 Logger，复用同一输出面板。 */
    public scoped(scope: string): Logger {
        return new Logger('', scope, this.minLevel, this.channel);
    }

    /** 调整最低输出级别，低于该级别的日志会被忽略。 */
    public setLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    public debug(message: string, extra?: unknown): void {
        this.write(LogLevel.Debug, message, extra);
    }

    public info(message: string, extra?: unknown): void {
        this.write(LogLevel.Info, message, extra);
    }

    public warn(message: string, extra?: unknown): void {
        this.write(LogLevel.Warn, message, extra);
    }

    public error(message: string, extra?: unknown): void {
        this.write(LogLevel.Error, message, extra);
    }

    /** 在输出面板中显示该日志（用于用户主动排查时）。 */
    public show(): void {
        this.channel.show(true);
    }

    public dispose(): void {
        this.channel.dispose();
        if (Logger.instance === this) {
            Logger.instance = undefined;
        }
    }

    private write(level: LogLevel, message: string, extra?: unknown): void {
        if (level < this.minLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const scopePart = this.scope ? ` [${this.scope}]` : '';
        const parts = [`${timestamp} ${LogLevel[level].toUpperCase()}${scopePart}`, message];

        if (extra !== undefined) {
            parts.push(Logger.formatExtra(extra));
        }

        this.channel.appendLine(parts.join(' '));
    }

    /** 将任意附加数据格式化为可读字符串。 */
    private static formatExtra(extra: unknown): string {
        if (typeof extra === 'string') {
            return extra;
        }

        if (extra instanceof Error) {
            return `${extra.name}: ${extra.message}`;
        }

        try {
            return JSON.stringify(extra);
        } catch {
            return String(extra);
        }
    }
}
