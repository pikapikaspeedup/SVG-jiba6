# 近身缠斗：真实投意图与可读结果

`Clinch` 不拥有投距离、伤害、保护或帧数。普通投仍为原启动/活动/恢复和 8 帧拆投窗口；commandThrow 不能预拆。Wake 起身保护、Pressure 防御硬直/脱压和 Spacing 原门禁保持不变。

## 接入 API

- `noteIntent(f,m,G)`：只在正式 `requestMove` 成功启动普通投后调用。记录 actionTick 与招式，不从任意 V 键按下记忆预拆。
- `canPreTech(f,G)`：真实合法投意图的年龄为 0–8 个可行动帧才有效；捕获中主动拆投继续走既有 escapeThrow。
- `consumeIntent(f)`：使用后清除；`reset(f)`：角色初始化清意图、结果、AI episode 和拆投姿态。
- `outcome(f,result,G,{target,move,point,dir})`：grab/whiff/impact 等真实事件提交冻结结果，每角色只保留最新，公共事件队列最多 64。
- `tech(a,d,G,context)`：提交双方共同拆投结果、清双方意图，并写各自 `_inkThrowTech={actorBirth,duration:8,dir}`。dir 为各自世界退开方向，姿态层只表达拨手，不移动根。
- `clear()` 清场景事件；`inspect()` 返回副本。

## CPU 同玩家风险

`update(f,b,obs,G,api)` 只读延迟 obs 来选择近身打、投或短后撤。190 内进入一次 episode，离开 260 或倒地/起身/成功投后退出；拆投也重置，并至少等待 24 个可行动帧。现有 nextDecision 与 plan.until 未完成时不抢占，单次 episode 不逐 idle 重掷骰。

投通过 `api.request`，退步通过已有 `api.plan/run`。刚被拆后降低投权重；短拳和后撤也使用正式战斗入口，不添加资源。旧近距随机投分支应由 root 移除，避免绕过 episode。

CPU 没有免费拆投计划：它必须同玩家一样实际成功启动投，承担落空风险，才得到 canPreTech。抓到后读取已延迟的 throwing 观测也必须满足 9/15/23 帧确认；当前窗口只有 8 帧，因此正常不能看见抓取后免费反应。旧固定 t7 随机拆投应移除。

## 有限检查

`node tests/clinch/unit.cjs` 覆盖 actionTick 预拆边界、指令投排除、冻结且有界结果、episode 一次决策、真实投意图拆投、捕获无意图不拆、已有计划不被抢占。已另完成真实规则 10 项、前后投/边角/空投/保护 19 项、公共按钮 3 项及 16 种子 CPU 的 3 项汇总检查；报告见 `qa/clinch/`。CPU 只证明样本中出现打/投/退且遵守已有决策时限，不代表竞技平衡。

合法意图的 noteIntent/canPreTech/consumeIntent 不依赖视觉或 AI 模块开关，关闭 Kinetic 不得破坏普通对投预拆。实际集成短检入口 `tests/clinch/playable.py` 覆盖 t8/t9、指令投、招架投、合法双投、非法防御/恢复输入与真实投空。招架投快照补写后，既有 1.2 系数开始生效，普通前投由 1200 变为 1440；这是实际伤害行为修复，应明确记录，不称为纯表现变化。
