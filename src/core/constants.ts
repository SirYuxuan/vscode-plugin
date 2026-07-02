/**
 * 全局共享常量。
 *
 * 这里集中管理散落在各处的路径片段字符串，避免在多个模块里硬编码，
 * 便于后续统一调整项目结构约定（例如支持新的资源目录）。
 */

/** 扩展在 package.json 中声明的唯一标识（命令 ID、配置节点的前缀）。 */
export const EXTENSION_ID = 'yuxuanplugin';

/**
 * 本地工程中被识别的资源目录标记。
 *
 * 命中不同标记会走不同的上传/删除策略，参见 {@link ResourceKind}。
 * 值均以斜杠包裹，便于在标准化后的 POSIX 风格路径中做 `includes` 判断。
 */
export const LOCAL_MARKERS = {
    /** Java 源码目录：`.../src/main/java/...` */
    java: '/src/main/java/',
    /** WEB-INF 资源目录：`.../src/main/webapp/WEB-INF/...` */
    webInf: '/src/main/webapp/WEB-INF/',
    /** 前端静态资源目录：`.../src/main/webapp/apps_res/...` */
    appsRes: '/src/main/webapp/apps_res/'
} as const;

/** 本地 Maven 编译输出目录（相对工程根目录），如 `target/classes`。 */
export const LOCAL_BUILD_OUTPUT = ['target', 'classes'] as const;

/** 远程服务器上的目录名约定。 */
export const REMOTE_DIRS = {
    webInf: 'WEB-INF',
    classes: 'classes',
    appsRes: 'apps_res'
} as const;

/**
 * 资源类别，决定上传/删除时映射到的远程目录与处理逻辑。
 * - `java`    → 编译产物 class 上传到 `WEB-INF/classes`
 * - `webInf`  → 原样上传到 `WEB-INF`
 * - `appsRes` → 原样上传到 `apps_res`
 */
export type ResourceKind = keyof typeof LOCAL_MARKERS;
