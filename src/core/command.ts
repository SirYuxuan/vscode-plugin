/**
 * 命令贡献点抽象。
 *
 * 每个可执行命令实现该接口后，交由 {@link CommandManager} 统一注册。
 * 新增功能时只需实现一个 CommandContribution 并加入注册列表，
 * 无需改动注册流程本身——这是本扩展的主要扩展点。
 */
export interface CommandContribution {
    /** 与 package.json `contributes.commands[].command` 完全一致的命令 ID。 */
    readonly id: string;

    /**
     * 命令执行体。
     * @param args VS Code 触发命令时透传的参数（如右键选中的资源 {@link import('vscode').Uri}）。
     */
    execute(...args: unknown[]): unknown | Promise<unknown>;
}
