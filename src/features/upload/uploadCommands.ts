/**
 * 「上传 / 删除」功能模块。
 *
 * 负责把本地资源经 SFTP 同步到远程服务器，或从远程删除。按资源类别
 * （Java 编译产物 / WEB-INF / apps_res）走不同映射规则，规则统一由
 * {@link ResourceMapping} 提供，SFTP 连接由 {@link SftpService} 托管。
 */

import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { ConfigManager, ServerConfig } from '../../core/config/configManager';
import { EXTENSION_ID, ResourceKind } from '../../core/constants';
import { FsUtils } from '../../core/fsUtils';
import { OperationHistory } from '../../core/history/operationHistory';
import { Logger } from '../../core/logging/logger';
import { PathResolver } from '../../core/paths/pathResolver';
import { SftpService, SftpSession } from '../../core/sftp/sftpService';
import { JavaLayout, ResourceMapping } from './resourceMapping';

/** 校验并规范化后的操作目标。 */
interface ResolvedTarget {
    fsPath: string;
    normalizedPath: string;
    kind: ResourceKind;
}

/**
 * upload / delete 命令的公共基类，收敛目标校验与配置校验等重复逻辑。
 */
abstract class ResourceCommandBase {
    protected readonly logger: Logger;

    constructor(
        protected readonly sftp: SftpService,
        protected readonly history: OperationHistory,
        logger: Logger,
        scope: string
    ) {
        this.logger = logger.scoped(scope);
    }

    /**
     * 校验右键选中的资源：存在、且落在受支持的目录范围内。
     * 不合法时给出用户提示并返回 undefined。
     */
    protected resolveTarget(target?: vscode.Uri): ResolvedTarget | undefined {
        if (!target?.fsPath) {
            vscode.window.showWarningMessage('请选择需要操作的资源。');
            return undefined;
        }

        const normalizedPath = PathResolver.normalize(target.fsPath);
        const kind = PathResolver.detectResourceKind(normalizedPath);

        if (!kind) {
            this.logger.debug('路径不在受支持范围', normalizedPath);
            vscode.window.showWarningMessage('当前选择的路径不在受支持的操作范围内。');
            return undefined;
        }

        return { fsPath: target.fsPath, normalizedPath, kind };
    }

    /** 读取并校验服务器配置；不可用时提示并返回 undefined。 */
    protected getValidatedConfig(): ServerConfig | undefined {
        const config = ConfigManager.getServerConfig();
        const error = ConfigManager.validateServerConfig(config);

        if (error) {
            this.logger.warn('服务器配置无效', error);
            vscode.window.showErrorMessage(error);
            return undefined;
        }

        return config;
    }

    /** 安全读取本地路径的 stat；失败时提示并返回 undefined。 */
    protected async statLocal(fsPath: string): Promise<Stats | undefined> {
        try {
            return await fs.stat(fsPath);
        } catch (error) {
            this.logger.error('读取本地路径失败', error);
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`无法读取本地路径: ${message}`);
            return undefined;
        }
    }
}

/**
 * 「上传」命令。
 */
export class UploadCommand extends ResourceCommandBase implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.upload`;

    constructor(sftp: SftpService, history: OperationHistory, logger: Logger) {
        super(sftp, history, logger, 'Upload');
    }

    public async execute(target?: vscode.Uri): Promise<void> {
        const resolved = this.resolveTarget(target);
        if (!resolved) {
            return;
        }

        const config = this.getValidatedConfig();
        if (!config) {
            return;
        }

        const stat = await this.statLocal(resolved.fsPath);
        if (!stat) {
            return;
        }

        try {
            await this.sftp.withSession(config, async (session) => {
                if (resolved.kind === 'java') {
                    await this.uploadJava(session, config, resolved, stat);
                } else {
                    await this.uploadPlain(session, config, resolved, stat);
                }
            });

            await this.history.record('upload', resolved.fsPath);
        } catch (error) {
            this.logger.error('上传失败', error);
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`上传失败: ${message}`);
        }
    }

    /** 上传 WEB-INF / apps_res 资源（原样上传）。 */
    private async uploadPlain(
        session: SftpSession,
        config: ServerConfig,
        resolved: ResolvedTarget,
        stat: Stats
    ): Promise<void> {
        const { remoteTarget } = ResourceMapping.plainTarget(
            config.projectPath,
            resolved.normalizedPath,
            resolved.kind as 'webInf' | 'appsRes'
        );

        if (stat.isDirectory()) {
            await session.putDirectory(resolved.fsPath, remoteTarget);
        } else {
            await session.putFile(resolved.fsPath, remoteTarget);
        }

        vscode.window.showInformationMessage(`已上传: ${remoteTarget}`);
    }

    /** 上传 Java 资源：实际上传的是 `target/classes` 下的编译产物。 */
    private async uploadJava(
        session: SftpSession,
        config: ServerConfig,
        resolved: ResolvedTarget,
        stat: Stats
    ): Promise<void> {
        const layout = ResourceMapping.javaLayout(config.projectPath, resolved.normalizedPath);

        if (!layout) {
            vscode.window.showErrorMessage('无法识别所选 Java 源文件所属的工程结构。');
            return;
        }

        if (!(await FsUtils.pathExists(layout.buildOutput))) {
            vscode.window.showWarningMessage('未找到编译输出目录 target/classes，请先执行构建。');
            return;
        }

        if (stat.isDirectory()) {
            await this.uploadJavaDirectory(session, layout);
            return;
        }

        if (stat.isFile()) {
            await this.uploadJavaFile(session, resolved, layout);
            return;
        }

        vscode.window.showWarningMessage('仅支持上传 Java 文件或目录。');
    }

    /** 上传整个 Java 包目录对应的编译产物目录。 */
    private async uploadJavaDirectory(session: SftpSession, layout: JavaLayout): Promise<void> {
        const compiledDir = path.join(layout.buildOutput, PathResolver.toFsPath(layout.relativeJavaPath));

        if (!(await FsUtils.pathExists(compiledDir))) {
            vscode.window.showWarningMessage('未找到对应的编译输出，请先执行构建。');
            return;
        }

        const remoteTarget = PathResolver.joinRemote(layout.remoteClassesBase, layout.relativeJavaPath);
        await session.putDirectory(compiledDir, remoteTarget);
        vscode.window.showInformationMessage(`已上传: ${remoteTarget}`);
    }

    /** 上传单个 Java 源文件对应的 class 文件（含内部类）。 */
    private async uploadJavaFile(
        session: SftpSession,
        resolved: ResolvedTarget,
        layout: JavaLayout
    ): Promise<void> {
        if (path.extname(resolved.fsPath) !== '.java') {
            vscode.window.showWarningMessage('仅支持上传 Java 源文件。');
            return;
        }

        const relativeDir = this.classRelativeDir(layout.relativeJavaPath);
        const compiledDir = relativeDir
            ? path.join(layout.buildOutput, PathResolver.toFsPath(relativeDir))
            : layout.buildOutput;

        if (!(await FsUtils.pathExists(compiledDir))) {
            vscode.window.showWarningMessage('未找到对应的编译输出，请先执行构建。');
            return;
        }

        const classBaseName = path.basename(layout.relativeJavaPath, '.java');
        const classFiles = await FsUtils.collectClassFiles(compiledDir, classBaseName);

        if (classFiles.length === 0) {
            vscode.window.showWarningMessage('未找到对应的 class 文件，请确认项目已编译。');
            return;
        }

        const remoteDir = relativeDir
            ? PathResolver.joinRemote(layout.remoteClassesBase, relativeDir)
            : layout.remoteClassesBase;

        await session.ensureDir(remoteDir);

        for (const file of classFiles) {
            await session.putFile(path.join(compiledDir, file), PathResolver.joinRemote(remoteDir, file));
        }

        vscode.window.showInformationMessage(`已上传类文件: ${classFiles.join(', ')}`);
    }

    /** 计算 class 文件所在的相对目录（去掉 `.` 表示的根目录）。 */
    private classRelativeDir(relativeJavaPath: string): string {
        const dir = path.posix.dirname(relativeJavaPath);
        return dir === '.' ? '' : dir;
    }
}

/**
 * 「删除」命令，上传的逆操作。删除远程资源，并可选同时删除本地文件。
 */
export class DeleteCommand extends ResourceCommandBase implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.delete`;

    constructor(sftp: SftpService, history: OperationHistory, logger: Logger) {
        super(sftp, history, logger, 'Delete');
    }

    public async execute(target?: vscode.Uri): Promise<void> {
        const resolved = this.resolveTarget(target);
        if (!resolved) {
            return;
        }

        const stat = await this.statLocal(resolved.fsPath);
        if (!stat) {
            return;
        }

        const removeLocal = await this.confirmRemoveLocal();
        if (removeLocal === undefined) {
            this.logger.debug('用户取消删除');
            return;
        }

        const config = this.getValidatedConfig();
        if (!config) {
            return;
        }

        try {
            await this.sftp.withSession(config, async (session) => {
                if (resolved.kind === 'java') {
                    await this.deleteJava(session, config, resolved, stat);
                } else {
                    await this.deletePlain(session, config, resolved);
                }
            });

            await this.history.record('delete', resolved.fsPath);
            vscode.window.showInformationMessage('远程资源删除完成。');

            if (removeLocal) {
                await this.removeLocalPath(resolved.fsPath, stat.isDirectory());
                vscode.window.showInformationMessage('本地资源已删除。');
            }
        } catch (error) {
            this.logger.error('删除失败', error);
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`删除失败: ${message}`);
        }
    }

    /** 弹出模态框询问是否同时删除本地文件。返回 undefined 表示用户取消。 */
    private async confirmRemoveLocal(): Promise<boolean | undefined> {
        const choice = await vscode.window.showInformationMessage(
            '是否同时删除本地文件？',
            { modal: true },
            '是',
            '否'
        );

        if (!choice) {
            return undefined;
        }

        return choice === '是';
    }

    /** 删除 WEB-INF / apps_res 远程资源。 */
    private async deletePlain(session: SftpSession, config: ServerConfig, resolved: ResolvedTarget): Promise<void> {
        const { remoteTarget } = ResourceMapping.plainTarget(
            config.projectPath,
            resolved.normalizedPath,
            resolved.kind as 'webInf' | 'appsRes'
        );

        this.logger.debug('删除远程资源', remoteTarget);
        await session.remove(remoteTarget);
    }

    /** 删除 Java 源文件对应的远程 class 文件 / 目录。 */
    private async deleteJava(
        session: SftpSession,
        config: ServerConfig,
        resolved: ResolvedTarget,
        stat: Stats
    ): Promise<void> {
        const layout = ResourceMapping.javaLayout(config.projectPath, resolved.normalizedPath);

        if (!layout) {
            vscode.window.showErrorMessage('无法识别所选 Java 源文件所属的工程结构。');
            return;
        }

        if (stat.isDirectory()) {
            const remoteTarget = PathResolver.joinRemote(layout.remoteClassesBase, layout.relativeJavaPath);
            this.logger.debug('删除 Java 目录', remoteTarget);
            await session.remove(remoteTarget);
            return;
        }

        if (path.extname(resolved.normalizedPath) !== '.java') {
            vscode.window.showWarningMessage('仅支持删除 Java 源文件。');
            return;
        }

        const relativeDir = this.classRelativeDir(layout.relativeJavaPath);
        const compiledDir = relativeDir
            ? path.join(layout.buildOutput, PathResolver.toFsPath(relativeDir))
            : layout.buildOutput;
        const classBaseName = path.basename(layout.relativeJavaPath, '.java');
        const remoteDir = relativeDir
            ? PathResolver.joinRemote(layout.remoteClassesBase, relativeDir)
            : layout.remoteClassesBase;

        // 优先用本地编译产物确定要删除的 class 列表；本地没有时回退到远程目录列举。
        let classFiles = await FsUtils.collectClassFiles(compiledDir, classBaseName);

        if (classFiles.length === 0) {
            this.logger.debug('本地无 class 文件，改为列举远程目录', remoteDir);
            classFiles = await session.listClassFiles(remoteDir, classBaseName);
        }

        if (classFiles.length === 0) {
            vscode.window.showWarningMessage('未找到需要删除的 class 文件。');
            return;
        }

        for (const file of classFiles) {
            await session.remove(PathResolver.joinRemote(remoteDir, file));
        }

        this.logger.debug('已删除 class 文件', classFiles);
    }

    /** 计算 class 文件所在的相对目录（去掉 `.` 表示的根目录）。 */
    private classRelativeDir(relativeJavaPath: string): string {
        const dir = path.posix.dirname(relativeJavaPath);
        return dir === '.' ? '' : dir;
    }

    /** 删除本地文件或目录。 */
    private async removeLocalPath(localPath: string, isDirectory: boolean): Promise<void> {
        try {
            await fs.rm(localPath, { recursive: isDirectory, force: true });
            this.logger.debug('已删除本地路径', localPath);
        } catch (error) {
            this.logger.error('删除本地文件失败', error);
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`删除本地文件失败: ${message}`);
        }
    }
}
