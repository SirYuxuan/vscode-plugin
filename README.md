# Yuxuan Dev Assistant

一个专门用于 Java 开发的 VS Code 扩展，快速将 Java 源文件路径转换为对应的 class 文件路径。

## 功能特性

### 🎯 Java 到 Class 路径转换
- **右键菜单访问**: 在 Java 文件中右键点击，选择 "V5Dev" -> "Copy of arthas"
- **智能路径解析**: 自动识别 Maven/Gradle 项目结构
- **一键复制**: 自动将转换后的 class 文件路径复制到剪贴板

### 🚀 上传 / 删除（SFTP）
- 右键 Java / WEB-INF / apps_res 资源，一键上传到远程服务器或删除远程资源
- **重新上传上次文件**（命令面板）：直接重传最近一次上传的资源
- **上传历史**（命令面板）：以列表查看最近操作并选择重传
- **保存自动上传**：开启 `yuxuanplugin.upload.autoUploadOnSave` 后，保存受支持目录内的文件会自动上传

### 🔗 XML ↔ Java 互跳
- 在 XML 中 Ctrl/Cmd + 点击全限定类名跳转到 Java 源文件
- **悬浮预览**：鼠标悬停类名即可查看解析到的源文件路径并直接打开
- **查找 XML 引用**：在 Java 文件右键「查找 XML 引用」，反向定位引用该类的 XML 配置
- 类名解析结果跨调用缓存，`.java` 文件增删时自动失效

### 🧰 开发者工具台（通用）
- 命令面板运行 **「工具: 开发者工具台」** 打开面板，纯本地、无联网
- 内置 8 样工具：JSON/YAML 格式化与互转、Base64、JWT 解码、Hash(MD5/SHA)、时间戳↔日期、URL 编解码/解析、UUID 生成、正则实时测试
- 计算全部在扩展宿主完成，Webview 只做界面

### 🌐 API 测试台（`.http` 文件，通用）
- 新建 `.http` 文件，每个请求上方出现 **「▶ 发送请求」** CodeLens，点击即发，响应在侧边面板展示
- 支持文件级变量 `@name = value` 与占位符 `{{name}}`，以及动态变量 `{{$timestamp}}` / `{{$uuid}}` / `{{$randomInt a b}}`
- 多环境：在 `.vscode/http-environments.json` 定义环境，点状态栏或命令 **「HTTP: 选择环境」** 切换
- 超时通过 `yuxuanplugin.http.timeout` 配置（默认 30000ms）

`.http` 示例：
```http
@base = https://httpbin.org

### 获取数据
GET {{base}}/get
Accept: application/json

### 提交数据
# @name 创建用户
POST {{base}}/post
Content-Type: application/json

{ "id": "{{$uuid}}", "ts": {{$timestamp}} }
```

`.vscode/http-environments.json` 示例：
```json
{
  "dev":  { "base": "http://localhost:8080" },
  "prod": { "base": "https://api.example.com" }
}
```

## 使用方法

1. 打开任意 Java 文件（.java 结尾）
2. 在编辑器区域右键点击
3. 选择菜单中的 "Yuxuan" -> "Copy of arthas"
4. class 文件路径将自动复制到剪贴板

## 路径转换示例

**输入（Java 源文件）**：
```
/Users/yuxuan/Develop/Java/yinjinda/v5/apps-customize/src/main/java/com/seeyon/apps/kkyf/cfs/node/CfsPayNode.java
```

**输出（Class 文件路径）**：
```
/opt/arthas/classes/com/seeyon/apps/kkyf/cfs/node/CfsPayNode.class
```

## 支持的项目结构

扩展能够识别以下标准的 Java 项目结构：

- **Maven 标准结构**: `src/main/java/`
- **Gradle 标准结构**: `src/java/`
- **其他标准结构**: 任何包含 `src/main/java/` 或 `src/java/` 的项目

## 转换规则

- 将 `src/main/java/` 替换为 `{serverBasePath}/classes/`
- 将 `.java` 后缀替换为 `.class`
- 保持包结构不变

## 系统要求

- VS Code 1.104.0 或更高版本
- 无其他特殊依赖

## 扩展设置

该扩展提供了以下配置选项，可在 VS Code 设置中进行配置：

### Arthas 服务器配置

- **`yuxuanplugin.arthas.serverBasePath`** (字符串)
  - 默认值: `/opt/arthas`
  - 描述: Arthas 服务器上的基础路径，用于构建 class 文件的完整路径

- **`yuxuanplugin.arthas.serverHost`** (字符串)
  - 默认值: `localhost` 
  - 描述: Arthas服务器主机地址

- **`yuxuanplugin.arthas.serverPort`** (数字)
  - 默认值: `3658`
  - 描述: Arthas服务器端口号
  - 范围: 1-65535

### 配置示例

在 VS Code 的 `settings.json` 中添加：

```json
{
  "yuxuanplugin.arthas.serverBasePath": "/opt/arthas",
  "yuxuanplugin.arthas.serverHost": "192.168.1.100",
  "yuxuanplugin.arthas.serverPort": 3658
}
```

### 访问配置

- 使用右键菜单 "Yuxuan" -> "Copy of arthas" 后，在"更多操作"中选择"查看配置"
- 或选择"打开设置"直接跳转到配置页面

## 代码架构

项目采用「核心能力（core）+ 功能模块（features）」的分层设计，`core` 提供可复用的基础设施，`features` 只承载各自的业务逻辑：

```
src/
├── extension.ts                 扩展入口，仅负责生命周期钩子
├── core/                        基础设施层
│   ├── commandManager.ts        组装根：装配依赖、注册命令/提供者/监听器
│   ├── command.ts               CommandContribution 命令贡献点接口（主要扩展点）
│   ├── constants.ts             集中管理路径标记、远程目录等常量
│   ├── fsUtils.ts               本地文件系统工具
│   ├── config/configManager.ts  强类型配置读取与校验
│   ├── history/operationHistory.ts  上传/删除操作历史（工作区持久化）
│   ├── java/javaClassResolver.ts    类名→源文件解析（带缓存与文件监听失效）
│   ├── logging/logger.ts        统一日志（单一 OutputChannel + 子作用域）
│   ├── paths/pathResolver.ts    纯函数路径解析（本地↔远程/编译产物映射）
│   ├── sftp/sftpService.ts      SFTP 连接托管 + 高层会话操作
│   └── webview/webviewHost.ts   Webview CSP/nonce/资源 URI 公共封装
├── media/                       Webview 静态资源（无构建，随包发布）
│   ├── toolbench/               开发者工具台前端
│   └── http/                    HTTP 响应面板前端
└── features/                    功能模块层
    ├── arthas/arthasCommands.ts        Copy of Arthas
    ├── findClass/findClassCommand.ts   寻找 Class（在文件管理器中定位编译产物）
    ├── upload/uploadCommands.ts        上传 / 删除命令
    ├── upload/historyCommands.ts       重传上次 / 上传历史命令
    ├── upload/autoUploadOnSave.ts      保存自动上传监听器
    ├── upload/resourceMapping.ts       资源本地→远程路径映射规则
    ├── xml/xmlLinkProvider.ts          XML → Java 跳转
    ├── xml/xmlHoverProvider.ts         XML 类名悬浮预览
    ├── xml/xmlClassScanner.ts          XML 类名扫描（链接/悬浮共用）
    ├── xml/findXmlReferencesCommand.ts Java → XML 反向查找引用
    ├── toolbench/                       开发者工具台（tools/ 纯函数 + registry + Panel）
    └── http/                            API 测试台（parser/变量/环境/client/CodeLens/面板）
```

> media/ 与 src/ 平级，是 Webview 的纯静态资源目录（非 features 子目录），此处为呈现完整结构一并列出。

### 如何新增一个命令

1. 在 `features/` 下新建实现 `CommandContribution` 的类（`id` 需与 package.json 中的命令 ID 一致）；
2. 在 `core/commandManager.ts` 的 `createCommands()` 返回列表中登记该类；
3. 在 package.json 的 `contributes.commands` / `menus` 中声明命令与菜单项。

注册流程本身无需改动——这是本扩展的主要扩展点。

### 设计原则

1. **单一职责**: 每个模块都有明确的职责边界
2. **依赖注入**: 通过构造函数注入依赖，便于测试
3. **配置驱动**: 通过配置管理器统一管理所有设置
4. **错误处理**: 完善的错误处理和用户友好的提示
5. **资源管理**: 正确的资源生命周期管理和释放

## 开发说明

### 编译项目
```bash
npm run compile
```

### 监视模式
```bash
npm run watch
```

### 运行测试
```bash
npm test
```



## 发布历史

### 0.0.1
- 初始版本发布
- 实现基础的 Copy of Arthas 功能
- 添加右键菜单集成

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个扩展。

## 许可证

MIT License
