# 功能测试指南

## 🧪 测试新的路径转换功能

### 测试步骤

1. **安装扩展**
   - 使用 F5 调试模式，或
   - 安装 VSIX 包：`yuxuanplugin-0.0.1.vsix`

2. **创建测试 Java 文件**
   ```java
   // 文件路径示例：/Users/yuxuan/Develop/Java/test-project/src/main/java/com/example/TestClass.java
   package com.example;
   
   public class TestClass {
       public void testMethod() {
           System.out.println("Hello World");
       }
   }
   ```

3. **测试路径转换**
   - 打开上述 Java 文件
   - 右键点击编辑器区域
   - 选择 "Yuxuan" -> "Copy of arthas"
   - 应该看到成功消息，class 路径已复制到剪贴板

4. **验证结果**
   - 预期输出：`/opt/arthas/classes/com/example/TestClass.class`
   - 检查剪贴板内容是否正确

5. **测试更多操作**
   - 点击 "更多操作"
   - 尝试各个选项：
     - ✅ 复制原始路径
     - ✅ 保存到文件
     - ✅ 显示路径信息
     - ✅ 查看配置
     - ✅ 打开设置

### 测试不同项目结构

#### Maven 标准结构
```
project/
└── src/
    └── main/
        └── java/
            └── com/
                └── example/
                    └── TestClass.java
```
**预期转换**：`{basePath}/classes/com/example/TestClass.class`

#### Gradle 标准结构  
```
project/
└── src/
    └── java/
        └── com/
            └── example/
                └── TestClass.java
```
**预期转换**：`{basePath}/classes/com/example/TestClass.class`

### 错误处理测试

1. **非 Java 文件测试**
   - 打开 .txt, .js, .py 等其他文件
   - 执行命令，应显示警告消息

2. **不符合标准结构的 Java 文件**
   - 创建不在 src/main/java 或 src/java 目录中的 Java 文件
   - 执行命令，应显示错误消息

3. **无活动编辑器测试**
   - 关闭所有文件
   - 通过命令面板执行 "Copy of arthas" 命令
   - 应显示警告消息

### 配置测试

1. **修改基础路径配置**
   ```json
   {
     "yuxuanplugin.arthas.serverBasePath": "/custom/arthas/path"
   }
   ```

2. **验证配置生效**
   - 重新执行转换
   - 检查输出路径是否使用新的基础路径

### 预期功能表现

✅ **成功场景**：
- Java 文件路径正确转换
- 剪贴板内容正确
- 各种操作选项正常工作
- 配置修改实时生效

❌ **错误处理**：
- 非 Java 文件给出友好提示
- 无法解析的路径给出明确错误信息
- 无活动编辑器时给出指导

🎯 **用户体验**：
- 操作简单直观
- 反馈信息清晰
- 配置界面易于访问