# YuxuanPlugin

一个专门用于 Java 开发的 VS Code 扩展，快速将 Java 源文件路径转换为对应的 class 文件路径。

## 功能特性

### 🎯 Java 到 Class 路径转换
- **右键菜单访问**: 在 Java 文件中右键点击，选择 "Yuxuan" -> "Copy of arthas"
- **智能路径解析**: 自动识别 Maven/Gradle 项目结构
- **一键复制**: 自动将转换后的 class 文件路径复制到剪贴板
- **多种操作选项**: 支持查看路径信息、保存到文件等功能

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

项目采用模块化设计，确保代码的可读性和可维护性：

- `src/extension.ts` - 扩展主入口文件
- `src/commands/index.ts` - 命令管理器，统一管理所有命令
- `src/commands/arthasCommands.ts` - Arthas 命令实现，包含所有业务逻辑
- `src/config/index.ts` - 配置管理器，处理扩展配置的读取、验证和监听

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
