import { REMOTE_DIRS } from '../../core/constants';
import { PathResolver } from '../../core/paths/pathResolver';

/** 原样上传类资源（WEB-INF / apps_res）的远程目标。 */
export interface PlainRemoteTarget {
    /** 该类资源在服务器上的根目录。 */
    remoteBase: string;
    /** 本次操作对应的远程目标路径。 */
    remoteTarget: string;
}

/** Java 资源相关的本地 / 远程路径解析结果。 */
export interface JavaLayout {
    /** 本地工程根目录。 */
    projectRoot: string;
    /** 相对 `src/main/java/` 的路径。 */
    relativeJavaPath: string;
    /** 本地编译输出目录 `<root>/target/classes`。 */
    buildOutput: string;
    /** 远程 class 根目录 `<projectPath>/WEB-INF/classes`。 */
    remoteClassesBase: string;
}

/**
 * 本地资源路径到远程路径的映射规则。
 *
 * 集中承载“哪个本地目录对应哪个远程目录”的约定，upload 与 delete 命令共用，
 * 避免两处各写一份、彼此走偏。
 */
export class ResourceMapping {
    /** 原样上传类资源的本地类别 → 远程目录名映射。 */
    private static readonly PLAIN_REMOTE_DIR: Record<'webInf' | 'appsRes', string> = {
        webInf: REMOTE_DIRS.webInf,
        appsRes: REMOTE_DIRS.appsRes
    };

    /** 解析 WEB-INF / apps_res 资源的远程目标。 */
    public static plainTarget(
        projectPath: string,
        normalizedPath: string,
        kind: 'webInf' | 'appsRes'
    ): PlainRemoteTarget {
        const remoteBase = PathResolver.joinRemote(projectPath, ResourceMapping.PLAIN_REMOTE_DIR[kind]);
        const relative = PathResolver.relativeAfterMarker(normalizedPath, kind);
        const remoteTarget = relative ? PathResolver.joinRemote(remoteBase, relative) : remoteBase;

        return { remoteBase, remoteTarget };
    }

    /** 解析 Java 资源的本地 / 远程路径布局；无法识别工程结构时返回 undefined。 */
    public static javaLayout(projectPath: string, normalizedPath: string): JavaLayout | undefined {
        const projectRoot = PathResolver.javaProjectRoot(normalizedPath);
        const relativeJavaPath = PathResolver.relativeAfterMarker(normalizedPath, 'java');

        if (!projectRoot || !relativeJavaPath) {
            return undefined;
        }

        return {
            projectRoot,
            relativeJavaPath,
            buildOutput: PathResolver.buildOutputDir(projectRoot),
            remoteClassesBase: PathResolver.joinRemote(projectPath, REMOTE_DIRS.webInf, REMOTE_DIRS.classes)
        };
    }
}
