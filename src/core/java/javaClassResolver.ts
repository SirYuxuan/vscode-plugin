/**
 * Java 类名 ↔ 源文件解析服务。
 *
 * 供 XML 链接 / 悬浮提示等多个功能共用：
 * - 将全限定类名解析为对应的 `.java` 文件 URI；
 * - 维护跨调用缓存，并通过文件监听在 `.java` 增删时自动失效，
 *   避免此前每次 `provideDocumentLinks` 都重建缓存、反复查盘的问题。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../logging/logger';

export class JavaClassResolver implements vscode.Disposable {
    private readonly logger: Logger;
    private readonly cache = new Map<string, vscode.Uri | null>();
    private readonly watcher: vscode.FileSystemWatcher;

    constructor(logger: Logger) {
        this.logger = logger.scoped('JavaResolver');

        // .java 文件增删会改变类名到路径的映射，需整体失效缓存；
        // 内容变更不影响文件位置，无需处理 onDidChange。
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.java');
        this.watcher.onDidCreate(() => this.invalidate());
        this.watcher.onDidDelete(() => this.invalidate());
    }

    public dispose(): void {
        this.watcher.dispose();
    }

    /** 判断字符串是否形似合法的全限定 Java 类名（含包名、末段大写开头）。 */
    public static isValidClassName(className: string): boolean {
        const parts = className.split('.');
        if (parts.length < 2) {
            return false;
        }

        return /^[A-Z][a-zA-Z0-9_$]*$/.test(parts[parts.length - 1]);
    }

    /** 解析全限定类名对应的源文件；带缓存。 */
    public async resolve(className: string): Promise<vscode.Uri | null> {
        const cached = this.cache.get(className);
        if (cached !== undefined) {
            return cached;
        }

        let uri: vscode.Uri | null;
        try {
            uri = await this.findJavaFile(className);
        } catch (error) {
            this.logger.warn('查找 Java 文件出错', { className, error });
            uri = null;
        }

        this.cache.set(className, uri);
        return uri;
    }

    private invalidate(): void {
        this.logger.debug('Java 文件变更，清空解析缓存');
        this.cache.clear();
    }

    /**
     * 定位类文件：先按常见工程结构直接拼路径，失败后退回全工作区搜索并
     * 用包声明校验，尽量避免误命中同名类。
     */
    private async findJavaFile(className: string): Promise<vscode.Uri | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        const classPath = className.replace(/\./g, '/') + '.java';
        const candidates = ['src/main/java/' + classPath, 'src/java/' + classPath, 'src/' + classPath, classPath];

        for (const folder of workspaceFolders) {
            for (const candidate of candidates) {
                const fullPath = path.join(folder.uri.fsPath, candidate);

                try {
                    await fs.promises.access(fullPath);
                    return vscode.Uri.file(fullPath);
                } catch {
                    // 尝试下一个候选路径
                }
            }
        }

        return this.searchByFileName(className);
    }

    /** 退化策略：按简单类名全局搜索，再用包声明校验命中。 */
    private async searchByFileName(className: string): Promise<vscode.Uri | null> {
        const simpleName = className.split('.').pop();
        const expectedPackage = className.split('.').slice(0, -1).join('.');

        const files = await vscode.workspace.findFiles('**/' + simpleName + '.java', '**/node_modules/**', 10);

        for (const file of files) {
            const content = Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf8');

            if (content.includes('package ' + expectedPackage + ';')) {
                return file;
            }
        }

        return null;
    }
}
