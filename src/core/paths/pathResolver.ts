import * as path from 'path';
import { LOCAL_BUILD_OUTPUT, LOCAL_MARKERS, ResourceKind } from '../constants';

/**
 * 路径解析工具集合（纯函数，无副作用、无 I/O）。
 *
 * 负责在“本地工程路径”与“远程服务器路径 / 编译输出路径”之间做映射，
 * 从原先的 UploadCommands 上帝类中抽离出来，便于单独测试与复用。
 *
 * 约定：对外统一使用 POSIX 风格（`/` 分隔）的字符串做匹配；涉及本地文件系统
 * 操作时再通过 {@link toFsPath} 转回平台分隔符。
 */
export class PathResolver {
    /** 将 Windows 反斜杠统一替换为正斜杠，得到便于匹配的规范化路径。 */
    public static normalize(fsPath: string): string {
        return fsPath.replace(/\\/g, '/');
    }

    /**
     * 判断给定（规范化后）路径命中哪一类资源目录。
     * 未命中任何已知目录时返回 `undefined`。
     */
    public static detectResourceKind(normalizedPath: string): ResourceKind | undefined {
        if (normalizedPath.includes(LOCAL_MARKERS.webInf)) {
            return 'webInf';
        }

        if (normalizedPath.includes(LOCAL_MARKERS.appsRes)) {
            return 'appsRes';
        }

        if (normalizedPath.includes(LOCAL_MARKERS.java)) {
            return 'java';
        }

        return undefined;
    }

    /**
     * 提取某个资源标记之后的相对路径。
     *
     * 例如 marker=`/src/main/webapp/WEB-INF/`，输入
     * `.../src/main/webapp/WEB-INF/spring/beans.xml` → 返回 `spring/beans.xml`。
     * 未命中 marker 时返回空字符串。
     */
    public static relativeAfterMarker(normalizedPath: string, kind: ResourceKind): string {
        const marker = LOCAL_MARKERS[kind];
        const index = normalizedPath.indexOf(marker);

        if (index === -1) {
            return '';
        }

        return normalizedPath.substring(index + marker.length).replace(/^\/+/, '');
    }

    /**
     * 提取 Java 源文件所属的工程根目录（`src/main/java` 之前的部分）。
     * 未命中 Java 标记时返回 `undefined`。
     */
    public static javaProjectRoot(normalizedPath: string): string | undefined {
        const index = normalizedPath.indexOf(LOCAL_MARKERS.java);

        if (index === -1) {
            return undefined;
        }

        return path.normalize(normalizedPath.substring(0, index));
    }

    /** 工程根目录下的编译输出目录，如 `<root>/target/classes`。 */
    public static buildOutputDir(projectRoot: string): string {
        return path.join(projectRoot, ...LOCAL_BUILD_OUTPUT);
    }

    /** 将 POSIX 相对路径转换成当前平台的文件系统路径。 */
    public static toFsPath(posixPath: string): string {
        return posixPath ? posixPath.split('/').join(path.sep) : '';
    }

    /**
     * 拼接远程路径。以 base 作为根（保证以 `/` 开头），忽略空片段，
     * 统一按 POSIX 规则拼接。
     */
    public static joinRemote(base: string, ...segments: string[]): string {
        const root = PathResolver.normalizeRemoteRoot(base);
        const cleaned = segments
            .filter((segment) => segment && segment.length > 0)
            .map((segment) => segment.replace(/\\/g, '/'));

        return path.posix.join(root, ...cleaned);
    }

    /** 规范化远程根路径：转正斜杠、去尾部斜杠、确保以 `/` 开头。 */
    public static normalizeRemoteRoot(root: string): string {
        if (!root) {
            return '/';
        }

        const replaced = root.replace(/\\/g, '/').replace(/\/+$/, '');

        if (replaced.length === 0) {
            return '/';
        }

        return replaced.startsWith('/') ? replaced : `/${replaced}`;
    }

    /** 规范化远程目录路径，根路径 / 空路径返回空串（表示无需创建）。 */
    public static normalizeRemoteDir(remoteDir: string): string {
        if (!remoteDir || remoteDir === '.' || remoteDir === '/') {
            return '';
        }

        return remoteDir.replace(/\\/g, '/').replace(/\/+$/, '');
    }

    /**
     * 构建匹配 class 文件（含内部类）的正则。
     * 例如 baseName=`Foo` 可匹配 `Foo.class`、`Foo$Bar.class`、`Foo$1.class`。
     */
    public static classFilePattern(baseName: string): RegExp {
        return new RegExp(`^${PathResolver.escapeRegExp(baseName)}(\\$.*)?\\.class$`);
    }

    /** 转义正则元字符，避免类名中的特殊字符破坏匹配。 */
    public static escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
