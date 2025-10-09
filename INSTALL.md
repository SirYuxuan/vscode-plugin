# YuxuanPlugin 安装指南

## 📦 安装方法

### 方法一：开发模式运行（推荐用于开发和测试）

1. **在当前 VS Code 窗口中**：
   - 按 `F5` 键 或 `Cmd+F5`（macOS）/ `Ctrl+F5`（Windows/Linux）
   - 选择 "Run Extension" 
   - VS Code 会自动打开一个新的"扩展开发主机"窗口
   - 在新窗口中测试插件功能

2. **或者使用命令面板**：
   - 按 `Cmd+Shift+P`（macOS）/ `Ctrl+Shift+P`（Windows/Linux）
   - 输入 "Debug: Start Debugging"
   - 选择并执行

### 方法二：安装 VSIX 包（推荐用于正式使用）

已经为您生成了安装包：`yuxuanplugin-0.0.1.vsix`

#### 通过 VS Code 界面安装：

1. **打开扩展面板**：
   - 点击左侧活动栏中的扩展图标
   - 或按 `Cmd+Shift+X`（macOS）/ `Ctrl+Shift+X`（Windows/Linux）

2. **安装 VSIX 文件**：
   - 点击扩展面板右上角的 "..." 菜单
   - 选择 "Install from VSIX..."
   - 选择文件：`/Users/yuxuan/Develop/Plugin/VSCode/YuxuanPlugin/yuxuanplugin-0.0.1.vsix`
   - 等待安装完成

#### 通过命令行安装：

```bash
# 方式1: 使用 code 命令（如果已配置）
code --install-extension /Users/yuxuan/Develop/Plugin/VSCode/YuxuanPlugin/yuxuanplugin-0.0.1.vsix

# 方式2: 使用完整路径
/Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code --install-extension /Users/yuxuan/Develop/Plugin/VSCode/YuxuanPlugin/yuxuanplugin-0.0.1.vsix
```

### 方法三：开发环境安装（用于持续开发）

如果您要继续开发这个插件：

1. **克隆或复制项目到本地**
2. **安装依赖**：
   ```bash
   cd /path/to/YuxuanPlugin
   npm install
   ```
3. **编译项目**：
   ```bash
   npm run compile
   ```
4. **使用 F5 调试运行**

## ✅ 验证安装

安装完成后，验证插件是否正常工作：

1. **检查扩展列表**：
   - 在扩展面板中搜索 "YuxuanPlugin"
   - 确认插件已安装并启用

2. **测试功能**：
   - 打开任意文件
   - 在编辑器区域右键点击
   - 查看是否出现 "Yuxuan" 子菜单
   - 点击 "Copy of arthas" 测试功能

3. **检查配置**：
   - 按 `Cmd+,`（macOS）/ `Ctrl+,`（Windows/Linux） 打开设置
   - 搜索 "yuxuanplugin"
   - 确认配置项正常显示

## 🔧 配置插件

安装后建议配置以下项目：

```json
{
  "yuxuanplugin.arthas.serverHost": "localhost",
  "yuxuanplugin.arthas.serverPort": 3658,
  "yuxuanplugin.arthas.serverBasePath": "/opt/arthas"
}
```

## 🚫 卸载插件

如需卸载：

1. **通过界面卸载**：
   - 在扩展面板中找到 "YuxuanPlugin"
   - 点击齿轮图标 → "Uninstall"

2. **通过命令行卸载**：
   ```bash
   code --uninstall-extension yuxuanplugin
   ```

## ❗ 故障排除

### 常见问题

1. **插件未显示在菜单中**：
   - 重新启动 VS Code
   - 检查插件是否已启用
   - 查看开发者控制台是否有错误

2. **配置不生效**：
   - 确认配置语法正确
   - 重新启动 VS Code
   - 检查配置作用域

3. **功能异常**：
   - 查看 VS Code 输出面板的错误信息
   - 使用 F5 调试模式检查控制台输出

### 获取帮助

如有问题，请检查：
- VS Code 开发者控制台：`Help` → `Toggle Developer Tools`
- 输出面板：`View` → `Output` → 选择 "YuxuanPlugin"

---

**推荐**：首次使用建议选择**方法一（F5 调试模式）**进行测试，确认功能正常后再使用**方法二（VSIX 安装）**进行正式安装。