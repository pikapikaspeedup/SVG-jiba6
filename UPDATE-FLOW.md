# 从 FLOW 06 到 FLOW 07

保留旧目录并先导出个人编辑；打开新版随附 HTML 体验新连段，再选择性导入。默认存储与旧版本独立，不自动覆盖。旧动作导入为整份覆盖，可能移除本轮新增 transitions；系统不偷偷向个人动作添加取消关系。

本次原有 690 份动作轨道、binding 与 boxes 不变，35 份只添加 transitions。原 16 条路线不变，新增 6 条舞路线。game.js 正式接入动作时钟／统一决策与新的命中停顿；不是只改 UI。

构建：`python tools/build_forge.py`。验证：`python tools/check_flow7.py`。先读 README.md，再看 TEST-REPORT-FLOW7.md。文档中 60 Hz 表示模拟步频，非官方节奏承诺或手机实测帧率。
