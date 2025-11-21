问题序号：PowerShell执行Gradle命令问题

## 问题元信息
- **问题分类**：其他
- **严重程度**：低
- **影响范围**：Windows PowerShell 用户
- **发现日期**：2025-11-21
- **解决状态**：已解决

## 问题现象
在 Windows PowerShell 终端中直接输入 `gradlew` 命令时报错：
`gradlew : The term 'gradlew' is not recognized as a name of a cmdlet, function, script file, or executable program.`

## 复现步骤
1. 步骤1：打开 Windows PowerShell。
2. 步骤2：进入包含 `gradlew` 脚本的 Android 工程根目录。
3. 步骤3：输入 `gradlew --stop` 并回车。

## 技术原因 (❌)
1. **PowerShell 安全策略**：与 CMD 不同，PowerShell 出于安全考虑，默认不会从当前目录加载可执行脚本，除非显式指定路径。
2. **路径解析**：直接输入 `gradlew` 时，PowerShell 仅在系统环境变量 `PATH` 中查找，而不会查找当前目录（Current Working Directory）。

## 正确实现方案 (✅)
在 PowerShell 中执行当前目录下的脚本或可执行文件，必须在文件名前加上 `.\`。

```powershell
# 错误写法 ❌
gradlew --stop

# 正确写法 ✅
.\gradlew --stop
```

## 预防措施
- **统一习惯**：在 Windows 终端（尤其是 PowerShell）中操作时，始终使用 `.\` 前缀来运行当前目录下的脚本。
- **使用 CMD**：如果习惯不加 `.\`，可以切换到传统的 Command Prompt (cmd.exe)。
