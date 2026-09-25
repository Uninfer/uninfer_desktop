# uninfer desktop

![uninfer](images/image.png)

`uninfer desktop` 是 uninfer 的公开桌面端发行仓库

本仓库用于应用展示、使用文档和版本发行。安装包及更新签名通过 Releases 提供, `releases/` 保存版本构建记录。

应用源码、构建和发布脚本由私有源码仓库维护, 不在此仓库中执行构建或发布命令。

## 版本规则

当前最新版本为 [**v0.0.1**](https://github.com/Uninfer/uninfer_desktop/releases/tag/v0.0.1), 从此版本开始在 GitHub 发布。

[下载 Windows x64 安装包](https://github.com/Uninfer/uninfer_desktop/releases/download/v0.0.1/uninfer_0.0.1_x64-setup.exe)

旧版本 [v26.9.4](https://gitee.com/itinyml/uninfer_desktop/releases/tag/v26.9.4) 保留在 Gitee, 不属于新的版本序列。

新版本序列从 **v0.0.1** 开始, 使用 `vX.Y.Z` 格式, 不再与年份或月份关联。

- `X`: 主版本, 不兼容变更时递增, `Y` 和 `Z` 归零。
- `Y`: 次版本, 新增功能时递增, `Z` 归零。
- `Z`: 修订版本, 问题修复时递增。

例如: `v0.0.1` -> `v0.0.2` -> `v0.2.0` -> `v1.0.0`。版本按数字大小比较并递增, 不复用已发布版本。

旧版发布记录保留。由于 `v0.0.1` 的版本号小于 `v26.9.4`, 且旧版使用 Gitee 更新地址, 旧版用户需手动下载安装 `v0.0.1`, 完成版本序列和更新渠道迁移。后续版本通过 GitHub 检查更新。
