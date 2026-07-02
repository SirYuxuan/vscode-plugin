import * as vscode from 'vscode';
import { EXTENSION_ID } from '../constants';

/** 操作类型。 */
export type OperationType = 'upload' | 'delete';

/** 一条操作历史记录。 */
export interface OperationRecord {
    type: OperationType;
    /** 操作目标的本地绝对路径。 */
    fsPath: string;
    /** 记录时间（epoch 毫秒）。 */
    timestamp: number;
}

/**
 * 上传 / 删除操作历史。
 *
 * 记录持久化在工作区级 {@link vscode.Memento} 中（路径与具体工作区强相关），
 * 供「重新上传上次文件」「上传历史」等命令读取。按 `fsPath + type` 去重，
 * 最近的记录排在最前，并限制总条数。
 */
export class OperationHistory {
    private static readonly STORAGE_KEY = `${EXTENSION_ID}.operationHistory`;
    private static readonly MAX_ENTRIES = 20;

    constructor(private readonly state: vscode.Memento) {}

    /** 追加一条记录（同路径同类型会被提到最前并去重）。 */
    public async record(type: OperationType, fsPath: string): Promise<void> {
        const existing = this.getAll().filter((item) => !(item.type === type && item.fsPath === fsPath));
        const next: OperationRecord[] = [{ type, fsPath, timestamp: Date.now() }, ...existing].slice(
            0,
            OperationHistory.MAX_ENTRIES
        );

        await this.state.update(OperationHistory.STORAGE_KEY, next);
    }

    /** 读取全部历史，最近在前。 */
    public getAll(): OperationRecord[] {
        return this.state.get<OperationRecord[]>(OperationHistory.STORAGE_KEY, []);
    }

    /** 获取最近一次某类型（默认上传）的记录。 */
    public getLast(type: OperationType = 'upload'): OperationRecord | undefined {
        return this.getAll().find((item) => item.type === type);
    }

    /** 清空历史。 */
    public async clear(): Promise<void> {
        await this.state.update(OperationHistory.STORAGE_KEY, []);
    }
}
