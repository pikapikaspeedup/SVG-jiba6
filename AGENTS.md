# 项目协作指南

本文件适用于本项目目录及其子目录。默认使用中文沟通，沿用现有代码风格，保持改动聚焦。

## Usage resets

<!-- observed: 2026-10-22 | status: active -->

- Never redeem, consume, or automatically use Codex usage reset cards on the user's behalf. Do not call `consume_usage_reset` or use a UI, API, script, automation, or delegated agent to redeem a reset. If usage is exhausted, wait for the natural reset or report the limit. Leave reset-card redemption to the user manually; continuing work or running unattended is not authorization to consume a card.

## 当前主线

2026-10-26 18:25（Europe/Rome）用户启动持续强化目标，要求至少工作 24 小时，并在其确认结束或主动停止前继续。动作系统、外观、角色/招式建模、决斗机制和整体体验均在范围内；阶段验收和 GitHub 提交只是存档，不能据此结束持续目标。最多并行两名子 Agent。已落地起身博弈、地面接触、八角色体积、逐击发力/结果收势、付费追空与角色化防守/霸体/手部造型、近身打投退与双人抓握、真实按键重击蓄势和付费假动作、接触驱动的连续攻击轨迹、角色短缩体积/动态压褶/手扇与抬腿遮挡、持久移动骨架/真实摆步/停车落脚/跳跃跨身/转身中出招、疾走独立换脚与有限余势踩步出招、接触拥有的地面受击/固定容量传导与部位声音画面、左右可读头部与角色表情、延迟公开事实驱动的试探/截击/有限落空追击、24普通技独立动作谱与整链接触/手扇一致、最终截面世界挥击/分拍裁剪/统一受力声音与局部光，继续加强整体交锋体验；具体进展记入 `docs/CONTINUOUS-ENGINE.md`。持续目标由本聊天管理，另有每 30 分钟检查的续跑任务；不把等待计为开发成果，不使用额度重置卡。

用户明确要求：迭代要大，以整个游戏的格斗体验为核心，重点提升动作引擎、动作特效、画面效果和打击感。不为重构而重构；暂停扩张重演/回放工具，已有底层保留。当前推进动作、空中战斗和角色化特效的整轮升级，以真实可玩效果交付。必要时让 Pro 设计，每轮最多一次并先打包源码。不得把小修、文档或验证基础计为大迭代。

## 项目现状与阅读顺序

- 第十五轮共享招式空间已整合：24 招固定骨长与极坐标路线、共同身体代理、真实扇缘和八分帧扫掠；支持招的空间范围明确更新，原伤害/时间/资源保持。阅读 `docs/STRIKE-MODEL.md` 与 `qa/strike-model/checkpoint.json`；72 姿态图和最终 TOI/编辑检查分属明确记录的两个构建，不能混用哈希。第十六轮共享防守身体正在推进，Pro 唯一咨询已发送，先读持续账本防止重复。

- 「身体参与对抗」三阶段已整合：身体与接触、攻防与连携、八角色与表现统一。当前规则见 `docs/NEXT-ENGINE.md`、`docs/PRESSURE-FLOW.md` 和 `docs/EIGHT-FIGHTERS.md`；当前检查汇总为 `qa/eight-fighters/completion.json`。隆/嘉米样板与旧十轮报告属于历史构建。2026-10-26 第一阶段 Pro 咨询已使用一次；第二、三阶段未新增咨询。用户授权的两名子 Agent 已用于本轮分工，后续遵循用户的 Agent 数量限制。

- 用户要求至少十轮大改进，状态见 `docs/ITERATIONS.md`。已完成十轮（10/10），范围和证据见账本与 `docs/DUEL.md`。最新跨轮证据为 `qa/duel/completion.json`；后续继续围绕实际格斗体验改进，不重新启动已经暂停的重演扩张。优先阅读相应能力文档及当前源码。每轮最多向 Pro 咨询一次，先打包源码，并读取账本防止重复发送。
- FLOW11 重演工作已暂缓，历史报告只代表其绑定的构建。不要继续扩张回放工具，也不把重演门禁当作本轮工作重点。按改动范围执行必要的真实战斗检查。
- 基础版本是 **INK FLOW 09**，一个可离线运行的非官方 2.5D SVG 格斗游戏及动作工坊。
- 优先阅读 `README.md` 顶部 FLOW9 说明、`docs/FLOW9-ENGINE.md`、`docs/FLOW9-PLAN.md`；已有验收范围见 `TEST-REPORT-FLOW9.md`。
- README 下半部分、`README-FORGE.md` 和旧版计划包含历史说明。发生冲突时，以当前源码及 FLOW9 合同为依据，不照搬旧版构建注入方式或存储命名。
- 此目录可能来自解压的源码包。使用 Git 前先确认仓库状态；没有 `.git` 时不要自行初始化仓库或假定分支、远端存在。

## 源码与产物

| 路径 | 职责 |
| --- | --- |
| `game.js` | 正式战斗模拟与运行时集成源码 |
| `street-fighter-6.html` | 构建使用的基础页面 |
| `src/ink/` | 时钟、动作采样、骨架、SVG 渲染、特效、镜头、存储与导出 |
| `src/ink/art/` | 各角色独立原画和装饰 |
| `forge/` | 工坊页面结构、样式和交互；FLOW9 设置主要在 `fluid.js` / `fluid.css` |
| `assets/ink/` | 工程配置、连段、角色模型、骨架和动作 JSON |
| `tools/build_forge.py` | 生产构建入口；脚本中明确列出运行模块及加载顺序 |
| `dist/` | 构建产物，禁止直接手改以代替修改源码 |
| `tests/flow9/` | 当前引擎合同、界面、可移植性、回归及性能测试 |
| `qa/flow9/` | 当前版本测试证据和结果；测试运行可能覆盖同名报告 |
| `legacy/`、其他版本 QA | 历史基线和追溯资料，不代表当前版本验证通过 |

正式创作入口为 `dist/INK-Street-Fighter-6.html`，玩家入口为 `dist/INK-Street-Fighter-6-Player.html`。文件名中的 6 不代表当前版本号。`OPEN-ME.html` 和 `index.html` 提供入口导航。

## 构建与验证

所有命令从项目根目录执行。使用 Python 3.10+；若系统没有 `python` 别名，将下面的 `python` 替换为 `python3`。

```sh
python tools/build_forge.py
python tools/check_flow9.py
```

- 构建仅需 Python 标准库，无 npm 安装或打包步骤。成品内嵌脚本和资产，保持离线使用能力。
- `check_flow9.py` 检查资产、版本、生产集成和成品；存在 Node.js 时还会执行生产 JavaScript 语法检查。缺少 Node 时该项会跳过，应如实说明。
- 修改生产源码后先重建，再执行相关测试。纯文档修改只需检查内容、路径和命令，不必重建或跑长测。
- 浏览器测试另需 Python Playwright 和 Chromium；依赖版本记录在 `requirements-dev.txt`。先确认环境，浏览器发现方式以所运行脚本为准，不假定所有脚本支持相同环境变量。

根据改动选择相关验证：

```sh
python tests/flow9/contracts.py          # 引擎合同
python tests/flow9/rhythm-matrix.py      # 连段与节奏组合
python tests/flow9/final-regressions.py  # 继承的战斗回归
python tests/flow9/ui.py                 # 界面交互
python tests/flow9/portability.py        # 独立 HTML 与导出
```

性能改动需要可比的独立顺序基准，禁止与压力测试或其他浏览器负载并行：

```sh
python tests/flow9/benchmark.py --baseline --seconds 25 --label local-old
python tests/flow9/benchmark.py --seconds 25 --label local-new
```

完整发布验收还包括以下步骤，不能用短测冒充耐久测试：

```sh
python tests/flow9/endurance.py --seconds 1500
python tools/check_flow9.py --evidence --require-soak
```

`--evidence` 核验既有报告及成品 SHA-256，不会运行所有测试；上面列出的常用测试也不等于完整证据集。完整要求以 `tools/check_flow9.py` 和当前引擎文档为准。源码或成品变化后，旧证据可能失效。不得手改报告、哈希、断言或资产签名来伪造通过。交付时注明实际执行的命令、结果及未验证项。

## 引擎与兼容约束

- 模拟以 60 Hz 整数步决定战斗状态、位置、血量、资源和判定；渲染读取状态并插值，不能因绘制次数或首绘顺序改变战斗结果。
- 保持相同模拟状态和采样时间得到相同姿态。暂停、命中定格、恢复和场景切换必须遵循统一时钟边界；菜单预览使用独立预览时钟。
- FLOW9 默认是稳定舞台、`fluid` 连贯节奏、1× 速度、完整特效；保留 `weighted` 和 `legacy`。稳定模式输出恒等相机矩阵；跟随模式读取角色根位置，不跟随手脚伸展或命中震屏。
- 不以降低骨架采样率、跳过人物帧、默认减少粒子或暗中调速伪装性能提升。当前关节求解步长为 0.25 动作帧，附件弹簧积分步长为 0.5 帧。
- 按需缓存必须支持顺播、倒拖及编辑修订失效。特效历史、节点池和回放应保持有界，暂停或冻结时不得重复派发事件。
- 保留 `SVG_FIGHTER`、`INKForge` 正式入口及现有全局 `INK` 模块协作方式。新增运行模块时检查构建列表和加载顺序，不引入构建时替换战斗函数体的补丁。
- 未明确要求调整玩法或资产时，保持伤害、判定、资源、取消规则和原始资产不变。当前检查锁定 707 份动作/模型/骨架/路线文件，其中包含 690 份动作和 22 条路线；确需改动时明确处理兼容与验证预期，不悄悄更新基线。
- FLOW9 使用独立存储空间 `ink-flow-sf6-v9`；不要自动覆盖旧版用户工程。持久化失败需保持明确的内存降级和导出路径，不能将暂存成功称为磁盘保存成功。
- 性能报告区分同步 CPU 工作、浏览器回调间隔和实际显示表现；模拟移动视口不等于真机测试，同人动作不宣称与官方帧数据等价。
