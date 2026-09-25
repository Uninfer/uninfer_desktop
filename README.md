# uninfer desktop

面向 uninfer 模型部署的桌面工具, 将 ONNX 模型转换、部署报告查看和图片转 C 头文件整合到图形界面中, 帮助你准备模型与测试数据。

发布版内置 Python 转换引擎及相关依赖, 安装后即可使用。

[下载](https://github.com/Uninfer/uninfer_desktop/releases) · [快速开始](#快速开始) · [问题反馈](https://github.com/Uninfer/uninfer_desktop/issues) · [许可证](LICENSE)

<img src="images/image.png" alt="uninfer desktop" width="160">

## 主要功能

- **模型转换**: 读取 ONNX 模型信息, 使用图片或 `.npy` / `.npz` 校准数据, 配置预处理和转换参数, 导出模型头文件与部署报告。
- **部署报告**: 查看转换结果及部署信息, 配合生成的模型头文件进行设备端集成。
- **图片转 C**: 根据模型报告处理图片, 生成量化数据或原始像素的 `.h` 文件, 用于设备端测试输入。
- **任务与配置**: 查看转换阶段、日志和结果, 保存常用配置; 切换页面时保留正在执行的任务。
- **版本更新**: 在应用内检查 GitHub 上发布的新版本。

## 下载与安装

当前提供 **Windows x64** 安装包。

1. 打开 [GitHub Releases](https://github.com/Uninfer/uninfer_desktop/releases), 选择所需的正式版本。
2. 在该版本的 `Assets` 中下载 `uninfer_<版本号>_x64-setup.exe`。
3. 运行安装包, 按提示完成安装并启动 uninfer。

安装时选择 `.exe` 文件即可, 无需下载更新签名或 GitHub 自动生成的源码压缩包。

## 快速开始

### 模型转换

1. 打开侧栏的 "转换" 页面, 选择 ONNX 模型和校准数据。
2. 设置输出目录、模型名称、预处理参数及所需的高级配置。
3. 启动转换, 在页面中查看任务状态、日志和结果。

默认输出目录为模型所在目录下的 `weights/`, 产物包括模型头文件 `.h` 和部署报告 `_report.json`。

### 图片转 C

1. 打开侧栏的 "图片" 页面, 选择图片及对应的模型报告。
2. 设置输出目录、数组名称, 选择 "量化数据" 或 "原始像素" 模式。
3. 点击 "生成 .h", 将生成的头文件用于设备端测试。

图片处理参数来自模型报告。使用 "原始像素" 模式时, 设备端仍需执行归一化与量化。

## 检查更新

打开侧栏的 "关于" 页面, 点击 "检查更新"。检查更新需要能够访问 GitHub; 也可以从 [Releases](https://github.com/Uninfer/uninfer_desktop/releases) 手动下载安装包。

## 常见问题

### 需要安装 Python 吗?

不需要。Windows 安装包已包含转换引擎及其运行依赖。

### 图片转 C 的两种模式有什么区别?

- **量化数据**: 按模型报告执行预处理与量化, 生成 `int8_t` 或 `uint8_t` 数组。
- **原始像素**: 执行缩放、填充及通道排序, 生成 `uint8_t` 像素数组, 归一化与量化由设备端完成。

### 转换完成是否代表数值验证通过?

桌面版暂不提供 Windows 数值验证。转换完成表示已生成部署产物, 数值精度仍需单独验证。

## 问题反馈

欢迎通过 [GitHub Issues](https://github.com/Uninfer/uninfer_desktop/issues) 提交问题或功能建议。报告问题时, 请尽量提供:

- 应用版本和 Windows 版本。
- 复现步骤、预期结果和实际表现。
- 相关错误日志或截图。
- 涉及模型或图片转换时, 可公开的最小复现文件及配置。

## 版本记录

安装包及版本说明见 [GitHub Releases](https://github.com/Uninfer/uninfer_desktop/releases), 各版本构建记录见 [`releases/`](releases/)。版本号采用 `vX.Y.Z` 格式。

## 许可证

本仓库采用 [Apache License 2.0](LICENSE)。
