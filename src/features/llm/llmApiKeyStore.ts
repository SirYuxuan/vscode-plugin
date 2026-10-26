/**
 * API Key 存储，基于 VS Code SecretStorage（系统钥匙串加密）。
 *
 * Key 只保存在本机，不写入 settings.json，也不会同步到其他设备。
 */

import * as vscode from 'vscode';
import { LLM_SECRET_PREFIX } from './llmConstants';

export class LlmApiKeyStore implements vscode.Disposable {
    private readonly changeEmitter = new vscode.EventEmitter<void>();

    /** API Key 发生变化（新增、修改、删除）时触发。 */
    public readonly onDidChange = this.changeEmitter.event;

    private readonly subscription: vscode.Disposable;

    constructor(private readonly secrets: vscode.SecretStorage) {
        // 其他窗口修改 Key 时同样需要刷新模型列表。
        this.subscription = this.secrets.onDidChange((event) => {
            if (event.key.startsWith(LLM_SECRET_PREFIX)) {
                this.changeEmitter.fire();
            }
        });
    }

    /**
     * 读取端点的 API Key。
     * @param endpointId 端点 ID
     * @returns 已保存的 Key；未设置时为 undefined
     */
    public async get(endpointId: string): Promise<string | undefined> {
        const value = await this.secrets.get(LLM_SECRET_PREFIX + endpointId);
        return value ? value : undefined;
    }

    /**
     * 判断端点是否已设置 API Key。
     * @param endpointId 端点 ID
     * @returns 已设置时为 true
     */
    public async has(endpointId: string): Promise<boolean> {
        return (await this.get(endpointId)) !== undefined;
    }

    /**
     * 保存端点的 API Key。
     * @param endpointId 端点 ID
     * @param apiKey 要保存的 Key
     */
    public async set(endpointId: string, apiKey: string): Promise<void> {
        await this.secrets.store(LLM_SECRET_PREFIX + endpointId, apiKey);
    }

    /**
     * 删除端点的 API Key。
     * @param endpointId 端点 ID
     */
    public async delete(endpointId: string): Promise<void> {
        await this.secrets.delete(LLM_SECRET_PREFIX + endpointId);
    }

    public dispose(): void {
        this.subscription.dispose();
        this.changeEmitter.dispose();
    }
}
