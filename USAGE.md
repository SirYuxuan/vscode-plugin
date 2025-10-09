# YuxuanPlugin 使用指南

## 快速开始

1. **安装扩展** - 在 VS Code 中安装 YuxuanPlugin 扩展

2. **配置服务器信息** (可选)
   - 按 `Cmd+,` (macOS) 或 `Ctrl+,` (Windows/Linux) 打开设置
   - 搜索 "yuxuanplugin"
   - 配置 Arthas 服务器信息

3. **使用功能**
   - 在任意编辑器区域右键
   - 选择 "Yuxuan" -> "Copy of arthas"
   - 输入 Arthas 命令

## 配置示例

### 本地开发环境
```json
{
  "yuxuanplugin.arthas.serverHost": "localhost",
  "yuxuanplugin.arthas.serverPort": 3658,
  "yuxuanplugin.arthas.serverBasePath": "/opt/arthas"
}
```

### 远程服务器环境
```json
{
  "yuxuanplugin.arthas.serverHost": "192.168.1.100",
  "yuxuanplugin.arthas.serverPort": 8563,
  "yuxuanplugin.arthas.serverBasePath": "/home/user/arthas"
}
```

## 常用 Arthas 命令

### 系统信息
- `jvm` - 查看 JVM 信息
- `sysenv` - 查看系统环境变量
- `sysprop` - 查看系统属性

### 线程相关
- `thread` - 查看所有线程信息
- `thread 1` - 查看线程 1 的详细信息
- `thread -b` - 查找阻塞的线程

### 类和方法
- `sc com.example.*` - 搜索类
- `sm com.example.Service` - 查看类的方法
- `jad com.example.Service` - 反编译类

### 监控和跟踪
- `watch com.example.Service method` - 监控方法执行
- `trace com.example.Service method` - 跟踪方法调用路径
- `monitor com.example.Service method` - 统计方法执行情况

## 最佳实践

1. **配置管理**
   - 为不同环境设置不同的配置
   - 使用工作区设置隔离项目配置

2. **命令使用**
   - 使用命令验证功能确保输入正确
   - 善用"更多操作"功能保存常用命令

3. **调试技巧**
   - 利用"查看配置"功能验证设置
   - 通过终端执行功能直接运行命令

## 故障排除

### 配置问题
- **问题**: 显示配置无效
- **解决**: 检查服务器地址和端口号格式，确保网络连通性

### 连接问题  
- **问题**: 无法连接到 Arthas 服务器
- **解决**: 
  1. 验证服务器地址和端口
  2. 检查防火墙设置
  3. 确认 Arthas 服务已启动

### 命令执行问题
- **问题**: 命令执行失败
- **解决**:
  1. 检查命令语法
  2. 验证类名和方法名
  3. 确认目标应用已连接到 Arthas