# 历史材料，不是当前运行入口

`game-flow3.js` 是用户项目原始未注入集成逻辑的源文件，其 SHA-256 保留在 VERSION.json。`build-flow4.py` 是上一版构建器的审阅副本，不应在此目录直接执行；其相对路径基于旧项目结构。`README-FLOW4.md` 是上一版说明的原文备份。

当前真正运行和修改的是根目录 `game.js`，构建器是 `tools/build_forge.py`，验收入口是 `tools/check_flow5.py`，打包入口是 `tools/package_flow5.py`。

根目录的 CHANGELOG-FLOW4.md、TEST-REPORT-FLOW4.md、旧 docs、tests/flow4 和 qa/flow4 保留作历史。旧版“game.js 未变”的说明仅适用于当时交付，不能拿来描述 FLOW5；旧 QA 不能当成本轮已重跑的证据。当前结果只从 qa/flow5/validation.json 追溯。
