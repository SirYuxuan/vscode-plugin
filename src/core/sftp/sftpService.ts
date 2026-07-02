import { promises as fs } from 'fs';
import * as path from 'path';
import SftpClient from 'ssh2-sftp-client';
import { ServerConfig } from '../config/configManager';
import { Logger } from '../logging/logger';
import { PathResolver } from '../paths/pathResolver';

/**
 * 单次 SFTP 会话的高层封装。
 *
 * 在 {@link SftpService.withSession} 内部创建并注入，向业务层暴露语义化的
 * 目录/文件操作（上传、创建目录、递归删除、列举 class），隐藏 ssh2-sftp-client
 * 的细节。业务层无需再关心连接生命周期。
 */
export class SftpSession {
    constructor(
        private readonly client: SftpClient,
        private readonly logger: Logger
    ) {}

    /** 确保远程目录存在（递归创建）；根路径 / 空路径直接跳过。 */
    public async ensureDir(remoteDir: string): Promise<void> {
        const normalized = PathResolver.normalizeRemoteDir(remoteDir);

        if (!normalized) {
            return;
        }

        if ((await this.client.exists(normalized)) === 'd') {
            return;
        }

        this.logger.debug('创建远程目录', normalized);
        await this.client.mkdir(normalized, true);
    }

    /** 上传单个文件，自动确保其所在远程目录存在。 */
    public async putFile(localFile: string, remoteFile: string): Promise<void> {
        await this.ensureDir(path.posix.dirname(remoteFile));
        await this.client.fastPut(localFile, remoteFile);
        this.logger.debug('已上传文件', remoteFile);
    }

    /** 递归上传整个本地目录到远程目录。 */
    public async putDirectory(localDir: string, remoteDir: string): Promise<void> {
        this.logger.debug('上传目录', `${localDir} -> ${remoteDir}`);
        await this.ensureDir(remoteDir);

        const entries = await fs.readdir(localDir, { withFileTypes: true });

        for (const entry of entries) {
            const localEntry = path.join(localDir, entry.name);
            const remoteEntry = PathResolver.joinRemote(remoteDir, entry.name);

            if (entry.isDirectory()) {
                await this.putDirectory(localEntry, remoteEntry);
            } else if (entry.isFile()) {
                await this.putFile(localEntry, remoteEntry);
            }
        }
    }

    /**
     * 递归删除远程路径（文件或目录）。
     * 出于安全考虑，拒绝删除根路径 `/`。
     */
    public async remove(remotePath: string): Promise<void> {
        if (!remotePath || remotePath === '/') {
            this.logger.warn('拒绝删除远程根路径', remotePath);
            return;
        }

        const exists = await this.client.exists(remotePath);

        if (!exists) {
            this.logger.debug('远程路径不存在，跳过删除', remotePath);
            return;
        }

        if (exists === 'd') {
            const entries = await this.client.list(remotePath);

            for (const entry of entries) {
                await this.remove(PathResolver.joinRemote(remotePath, entry.name));
            }

            await this.client.rmdir(remotePath);
            this.logger.debug('已删除远程目录', remotePath);
            return;
        }

        await this.client.delete(remotePath);
        this.logger.debug('已删除远程文件', remotePath);
    }

    /** 列举远程目录中匹配某个基名的 class 文件（含内部类）。 */
    public async listClassFiles(remoteDir: string, baseName: string): Promise<string[]> {
        try {
            const exists = await this.client.exists(remoteDir);

            if (exists !== 'd') {
                this.logger.debug('远程目录不存在或非目录', remoteDir);
                return [];
            }

            const pattern = PathResolver.classFilePattern(baseName);
            const entries = await this.client.list(remoteDir);

            return entries.filter((entry) => pattern.test(entry.name)).map((entry) => entry.name);
        } catch (error) {
            this.logger.warn('列举远程 class 文件失败', { remoteDir, error });
            return [];
        }
    }
}

/**
 * SFTP 连接管理入口。
 *
 * {@link withSession} 统一负责“连接 → 执行 → 无论成败都断开”的流程，
 * 消除此前散落在各处的连接样板代码，让业务层只关注具体操作。
 */
export class SftpService {
    constructor(private readonly logger: Logger) {}

    /**
     * 建立连接、执行回调、并在结束后自动断开。
     *
     * @param config 服务器连接配置
     * @param work   在会话可用期间执行的业务逻辑
     * @returns 回调的返回值
     */
    public async withSession<T>(
        config: ServerConfig,
        work: (session: SftpSession) => Promise<T>
    ): Promise<T> {
        const client = new SftpClient();
        this.logger.debug('连接服务器', `${config.host}:${config.port}`);

        try {
            await client.connect({
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password
            });

            return await work(new SftpSession(client, this.logger));
        } finally {
            try {
                await client.end();
            } catch (closeError) {
                this.logger.warn('关闭 SFTP 连接失败', closeError);
            }
        }
    }
}
