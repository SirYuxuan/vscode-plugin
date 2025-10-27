import type { Stats } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import SftpClient from 'ssh2-sftp-client';
import * as vscode from 'vscode';
import { ConfigManager, ServerConfig } from '../../core/config/configManager';

/**
 * 处理资源管理器中的上传相关命令。
 */
export class UploadCommands implements vscode.Disposable {
    private static readonly WEB_INF_MARKER = '/src/main/webapp/WEB-INF/';
    private static readonly SRC_JAVA_MARKER = '/src/main/java/';

    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Yuxuan Upload');
    }

    /**
     * 触发上传流程。当前作为占位符，后续将补充具体实现。
     */
    public async upload(target?: vscode.Uri): Promise<void> {
        this.log('upload command triggered');

        if (!target) {
            this.log('no target provided');
            vscode.window.showWarningMessage('请选择需要上传的资源。');
            return;
        }

        if (!target.fsPath) {
            this.log('target missing fsPath', target.toString());
            vscode.window.showWarningMessage('无法获取所选资源路径。');
            return;
        }

        const normalizedPath = target.fsPath.replace(/\\/g, '/');
        this.log('normalized target path', normalizedPath);

        if (normalizedPath.includes(UploadCommands.WEB_INF_MARKER)) {
            this.log('matched WEB-INF branch');
            await this.uploadWebInfResource(target.fsPath);
            return;
        }

        if (normalizedPath.includes(UploadCommands.SRC_JAVA_MARKER)) {
            this.log('matched Java branch');
            await this.uploadJavaResource(target.fsPath);
            return;
        }

        this.log('path outside supported scope');
        vscode.window.showWarningMessage('当前选择的路径不在支持的上传范围内。');
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }

    private async uploadWebInfResource(localPath: string): Promise<void> {
        const config = ConfigManager.getServerConfig();
        const validationError = this.validateServerConfig(config);

        if (validationError) {
            this.log('invalid server configuration', validationError);
            vscode.window.showErrorMessage(validationError);
            return;
        }

        const normalizedLocalPath = localPath.replace(/\\/g, '/');
        const relativePath = this.extractRelativeWebInfPath(normalizedLocalPath);
        const remoteBase = this.joinRemotePaths(config.projectPath, 'WEB-INF');
        const remoteTarget = relativePath
            ? this.joinRemotePaths(remoteBase, relativePath)
            : remoteBase;

        const sftp = new SftpClient();

        this.log('connecting to server', `${config.host}:${config.port}`);

        try {
            await sftp.connect({
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password
            });

            const stat = await fs.stat(localPath);

            if (stat.isDirectory()) {
                await this.uploadDirectory(sftp, localPath, remoteTarget);
            } else {
                await this.ensureRemoteDir(sftp, path.posix.dirname(remoteTarget));
                await sftp.fastPut(localPath, remoteTarget);
                this.log('uploaded file', remoteTarget);
            }

            vscode.window.showInformationMessage(`已上传: ${remoteTarget}`);
        } catch (error) {
            this.log('upload failed', error);
            vscode.window.showErrorMessage(`上传失败: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            try {
                await sftp.end();
            } catch (closeError) {
                this.log('failed to close sftp connection', closeError);
            }
        }
    }

    private async uploadJavaResource(localPath: string): Promise<void> {
        const config = ConfigManager.getServerConfig();
        const validationError = this.validateServerConfig(config);

        if (validationError) {
            this.log('invalid server configuration', validationError);
            vscode.window.showErrorMessage(validationError);
            return;
        }

        const normalizedLocalPath = localPath.replace(/\\/g, '/');
        const projectRoot = this.extractJavaProjectRoot(normalizedLocalPath);

        if (!projectRoot) {
            this.log('unable to determine project root', normalizedLocalPath);
            vscode.window.showErrorMessage('无法识别所选 Java 源文件所属的项目根目录。');
            return;
        }

        const relativeJavaPath = this.extractRelativeJavaPath(normalizedLocalPath);

        if (!relativeJavaPath) {
            this.log('unable to resolve relative java path', normalizedLocalPath);
            vscode.window.showWarningMessage('无法解析所选 Java 源文件的相对路径。');
            return;
        }

        let stat: Stats;

        try {
            stat = await fs.stat(localPath);
        } catch (error) {
            this.log('failed to stat local path', error);
            vscode.window.showErrorMessage(`无法读取本地路径: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }

        const targetClassesRoot = path.join(projectRoot, 'target', 'classes');

        if (!(await this.pathExists(targetClassesRoot))) {
            this.log('target/classes directory missing', targetClassesRoot);
            vscode.window.showWarningMessage('未找到编译输出目录 target/classes，请先执行构建。');
            return;
        }

        const remoteBase = this.joinRemotePaths(config.projectPath, 'WEB-INF', 'classes');
        const sftp = new SftpClient();

        this.log('connecting to server for java upload', `${config.host}:${config.port}`);

        try {
            await sftp.connect({
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password
            });

            if (stat.isDirectory()) {
                const compiledDir = path.join(targetClassesRoot, this.toFsPath(relativeJavaPath));

                if (!(await this.pathExists(compiledDir))) {
                    this.log('compiled directory not found', compiledDir);
                    vscode.window.showWarningMessage('未找到对应的编译输出，请先执行构建。');
                    return;
                }

                const remoteTarget = relativeJavaPath
                    ? this.joinRemotePaths(remoteBase, relativeJavaPath)
                    : remoteBase;

                await this.uploadDirectory(sftp, compiledDir, remoteTarget);
                vscode.window.showInformationMessage(`已上传: ${remoteTarget}`);
                return;
            }

            if (stat.isFile()) {
                const ext = path.extname(localPath);

                if (ext !== '.java') {
                    this.log('unsupported file type for java upload', ext);
                    vscode.window.showWarningMessage('仅支持上传 Java 源文件。');
                    return;
                }

                let relativeDir = path.posix.dirname(relativeJavaPath);

                if (relativeDir === '.') {
                    relativeDir = '';
                }

                const compiledDir = relativeDir
                    ? path.join(targetClassesRoot, this.toFsPath(relativeDir))
                    : targetClassesRoot;

                if (!(await this.pathExists(compiledDir))) {
                    this.log('compiled directory for file not found', compiledDir);
                    vscode.window.showWarningMessage('未找到对应的编译输出，请先执行构建。');
                    return;
                }

                const classBaseName = path.basename(relativeJavaPath, '.java');
                const classFiles = await this.collectClassFiles(compiledDir, classBaseName);

                if (classFiles.length === 0) {
                    this.log('no class files found for java source', {
                        compiledDir,
                        classBaseName
                    });
                    vscode.window.showWarningMessage('未找到对应的 class 文件，请确认项目已编译。');
                    return;
                }

                const remoteDir = relativeDir
                    ? this.joinRemotePaths(remoteBase, relativeDir)
                    : remoteBase;

                await this.ensureRemoteDir(sftp, remoteDir);

                for (const file of classFiles) {
                    const localClassPath = path.join(compiledDir, file);
                    const remoteClassPath = this.joinRemotePaths(remoteDir, file);
                    await sftp.fastPut(localClassPath, remoteClassPath);
                    this.log('uploaded class file', remoteClassPath);
                }

                vscode.window.showInformationMessage(`已上传类文件: ${classFiles.join(', ')}`);
                return;
            }

            this.log('unsupported fs entry for java upload');
            vscode.window.showWarningMessage('仅支持上传 Java 文件或目录。');
        } catch (error) {
            this.log('upload failed', error);
            vscode.window.showErrorMessage(`上传失败: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            try {
                await sftp.end();
            } catch (closeError) {
                this.log('failed to close sftp connection', closeError);
            }
        }
    }

    private extractRelativeJavaPath(normalizedLocalPath: string): string | undefined {
        const index = normalizedLocalPath.indexOf(UploadCommands.SRC_JAVA_MARKER);

        if (index === -1) {
            return undefined;
        }

        const relative = normalizedLocalPath.substring(index + UploadCommands.SRC_JAVA_MARKER.length);

        return relative.replace(/^\/+/, '');
    }

    private extractJavaProjectRoot(normalizedLocalPath: string): string | undefined {
        const index = normalizedLocalPath.indexOf(UploadCommands.SRC_JAVA_MARKER);

        if (index === -1) {
            return undefined;
        }

        const root = normalizedLocalPath.substring(0, index);

        return path.normalize(root);
    }

    private toFsPath(posixPath: string): string {
        if (!posixPath) {
            return '';
        }

        return posixPath.split('/').join(path.sep);
    }

    private async pathExists(fsPath: string): Promise<boolean> {
        try {
            await fs.access(fsPath);
            return true;
        } catch {
            return false;
        }
    }

    private async collectClassFiles(dir: string, baseName: string): Promise<string[]> {
        try {
            const entries = await fs.readdir(dir);
            const pattern = new RegExp(`^${this.escapeRegExp(baseName)}(\\$.*)?\\.class$`);

            return entries.filter((entry) => pattern.test(entry));
        } catch (error) {
            this.log('failed to list class files', {
                dir,
                error: error instanceof Error ? error.message : String(error)
            });

            return [];
        }
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async uploadDirectory(client: SftpClient, localDir: string, remoteDir: string): Promise<void> {
        this.log('upload directory', `${localDir} -> ${remoteDir}`);

        await this.ensureRemoteDir(client, remoteDir);

        const entries = await fs.readdir(localDir, { withFileTypes: true });

        for (const entry of entries) {
            const localEntryPath = path.join(localDir, entry.name);
            const remoteEntryPath = this.joinRemotePaths(remoteDir, entry.name);

            if (entry.isDirectory()) {
                await this.uploadDirectory(client, localEntryPath, remoteEntryPath);
            } else if (entry.isFile()) {
                await this.ensureRemoteDir(client, path.posix.dirname(remoteEntryPath));
                await client.fastPut(localEntryPath, remoteEntryPath);
                this.log('uploaded file', remoteEntryPath);
            }
        }
    }

    private async ensureRemoteDir(client: SftpClient, remoteDir: string): Promise<void> {
        const normalized = this.normalizeRemoteDir(remoteDir);

        if (!normalized) {
            return;
        }

        const exists = await client.exists(normalized);

        if (exists === 'd') {
            return;
        }

        this.log('creating remote directory', normalized);
        await client.mkdir(normalized, true);
    }

    private extractRelativeWebInfPath(normalizedLocalPath: string): string {
        const index = normalizedLocalPath.indexOf(UploadCommands.WEB_INF_MARKER);

        if (index === -1) {
            return '';
        }

        const relative = normalizedLocalPath.substring(index + UploadCommands.WEB_INF_MARKER.length);

        return relative.replace(/^\/+/, '');
    }

    private normalizeRemoteDir(remoteDir: string): string {
        if (!remoteDir || remoteDir === '.' || remoteDir === '/') {
            return '';
        }

        const withoutBackslash = remoteDir.replace(/\\/g, '/');

        return withoutBackslash.replace(/\/+$/, '');
    }

    private joinRemotePaths(base: string, ...segments: string[]): string {
        const normalizedBase = this.normalizeRemoteRoot(base);
        const cleanedSegments = segments
            .filter((segment) => segment && segment.length > 0)
            .map((segment) => segment.replace(/\\/g, '/'));

        return path.posix.join(normalizedBase, ...cleanedSegments);
    }

    private normalizeRemoteRoot(root: string): string {
        if (!root) {
            return '/';
        }

        const replaced = root.replace(/\\/g, '/').replace(/\/+$/, '');

        if (replaced.length === 0) {
            return '/';
        }

        return replaced.startsWith('/') ? replaced : `/${replaced}`;
    }

    private validateServerConfig(config: ServerConfig): string | undefined {
        if (!config.host) {
            return '请先在设置中配置服务器主机地址。';
        }

        if (!config.username) {
            return '请先在设置中配置服务器登录账号。';
        }

        if (!config.password) {
            return '请先在设置中配置服务器登录密码。';
        }

        if (!config.projectPath) {
            return '请先在设置中配置服务器项目路径。';
        }

        return undefined;
    }

    private log(message: string, extra?: unknown): void {
        const parts = ['[Yuxuan Upload]', message];
        if (extra !== undefined) {
            parts.push(this.formatExtra(extra));
        }

        this.outputChannel.appendLine(parts.join(' '));
    }

    private formatExtra(extra: unknown): string {
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
