import { promises as fs } from 'fs';
import { PathResolver } from './paths/pathResolver';

/**
 * 本地文件系统的轻量工具函数，供各 feature 复用。
 */
export class FsUtils {
    /** 判断本地路径是否存在。 */
    public static async pathExists(fsPath: string): Promise<boolean> {
        try {
            await fs.access(fsPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 列举目录中匹配某个基名的 class 文件（含内部类，如 `Foo$Bar.class`）。
     * 目录不存在或读取失败时返回空数组。
     */
    public static async collectClassFiles(dir: string, baseName: string): Promise<string[]> {
        try {
            const pattern = PathResolver.classFilePattern(baseName);
            const entries = await fs.readdir(dir);

            return entries.filter((entry) => pattern.test(entry));
        } catch {
            return [];
        }
    }
}
