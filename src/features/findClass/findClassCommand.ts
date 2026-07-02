/**
 * 「寻找 Class」功能模块。
 *
 * 根据选中的 Java 源文件，定位其在 `target/classes` 下的编译产物，
 * 并在系统文件管理器（Finder / 资源管理器）中高亮显示。
 * 与「上传/删除」是独立职责，因此单独成模块。
 */

import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { CommandContribution } from '../../core/command';
import { EXTENSION_ID, LOCAL_MARKERS } from '../../core/constants';
import { FsUtils } from '../../core/fsUtils';
import { Logger } from '../../core/logging/logger';
import { PathResolver } from '../../core/paths/pathResolver';

const execAsync = promisify(exec);

export class FindClassCommand implements CommandContribution {
    public readonly id = `${EXTENSION_ID}.findClass`;

    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.scoped('FindClass');
    }

    public async execute(target?: vscode.Uri): Promise<void> {
        const normalizedPath = this.resolveJavaTarget(target);

        if (!normalizedPath) {
            return;
        }

        const projectRoot = PathResolver.javaProjectRoot(normalizedPath);
        const relativeJavaPath = PathResolver.relativeAfterMarker(normalizedPath, 'java');

        if (!projectRoot || !relativeJavaPath) {
            this.logger.warn('无法解析工程根目录或相对路径', normalizedPath);
            vscode.window.showErrorMessage('无法识别所选 Java 源文件所属的工程结构。');
            return;
        }

        const buildOutput = PathResolver.buildOutputDir(projectRoot);

        if (!(await FsUtils.pathExists(buildOutput))) {
            this.logger.warn('未找到编译输出目录', buildOutput);
            vscode.window.showWarningMessage('未找到编译输出目录 target/classes，请先执行构建。');
            return;
        }

        const compiledDir = this.resolveCompiledDir(buildOutput, relativeJavaPath);
        const classBaseName = path.basename(relativeJavaPath, '.java');
        const classFiles = await FsUtils.collectClassFiles(compiledDir, classBaseName);

        if (classFiles.length === 0) {
            this.logger.warn('未找到 class 文件', { compiledDir, classBaseName });
            vscode.window.showWarningMessage('未找到对应的 class 文件，请确认项目已编译。');
            return;
        }

        const selected =
            classFiles.length === 1
                ? classFiles[0]
                : await vscode.window.showQuickPick(classFiles, {
                      placeHolder: `找到 ${classFiles.length} 个 class 文件，请选择一个：`
                  });

        if (selected) {
            await this.revealInFileManager(path.join(compiledDir, selected));
        }
    }

    /** 校验并规范化目标 Java 文件路径；不合法时给出提示并返回 undefined。 */
    private resolveJavaTarget(target?: vscode.Uri): string | undefined {
        if (!target?.fsPath) {
            vscode.window.showWarningMessage('请选择需要查找的 Java 文件。');
            return undefined;
        }

        const normalizedPath = PathResolver.normalize(target.fsPath);

        if (!normalizedPath.endsWith('.java')) {
            vscode.window.showWarningMessage('请选择 Java 源文件。');
            return undefined;
        }

        if (!normalizedPath.includes(LOCAL_MARKERS.java)) {
            vscode.window.showWarningMessage('Java 文件不在 src/main/java 目录结构中。');
            return undefined;
        }

        return normalizedPath;
    }

    /** 由相对 Java 路径推导出编译产物所在目录。 */
    private resolveCompiledDir(buildOutput: string, relativeJavaPath: string): string {
        let relativeDir = path.posix.dirname(relativeJavaPath);

        if (relativeDir === '.') {
            relativeDir = '';
        }

        return relativeDir ? path.join(buildOutput, PathResolver.toFsPath(relativeDir)) : buildOutput;
    }

    /** 在当前操作系统的文件管理器中定位并高亮目标文件。 */
    private async revealInFileManager(classPath: string): Promise<void> {
        try {
            if (!(await FsUtils.pathExists(classPath))) {
                this.logger.warn('class 文件不存在', classPath);
                vscode.window.showErrorMessage(`class 文件不存在: ${classPath}`);
                return;
            }

            const command = this.buildRevealCommand(classPath);
            this.logger.debug('执行文件管理器命令', command);
            await execAsync(command);
            vscode.window.showInformationMessage(`已在系统文件管理器中显示: ${path.basename(classPath)}`);
        } catch (error) {
            this.logger.error('在文件管理器中显示失败', error);
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`无法在文件管理器中显示文件: ${message}`);
        }
    }

    /** 根据平台返回“定位并选中文件”的 shell 命令。 */
    private buildRevealCommand(classPath: string): string {
        switch (process.platform) {
            case 'darwin':
                return `open -R "${classPath}"`;
            case 'win32':
                return `explorer /select,"${classPath.replace(/\//g, '\\')}"`;
            default:
                // Linux 等平台无统一“选中文件”能力，退而打开所在目录。
                return `xdg-open "${path.dirname(classPath)}"`;
        }
    }
}
