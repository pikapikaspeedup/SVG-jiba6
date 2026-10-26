# 接触拥有的地面受击身体

地面普通受击现在由 `HitEpisode` 独占最终视觉骨架，从中招前的实际姿势接续。旧 authored hit clip 仍服务原战斗姿态和判定；不再驱动这一段的显示身体。根位置、伤害、hurtbox、硬直与活动帧不改。空中、击倒、超必捕获和投技保留原轨道。

## 接触与状态边界

互击在共同只读阶段按防守者捕获最终 `VisualFrame`；直接接触入口在伤害、hitHeight、reaction 写入前捕获。一次 hit→tumble 使用同一快照。`HitEpisode.begin` 开启表现事务，Kinetic 仍提交声音/特效事件，但身体 reaction 先暂存；`setState` 内不重复捕获或绑定通用 impact 桥。接触的最终状态确定后 `finish` 才发布地面 owner，或者交还空中轨道。

同一受击段只建立一次 carrier；后续命中保留它并增加受力状态，不能把已变形的身体重新作为零点再叠旧冲量。真实接触点、法线、hurtPart 和来向决定分区、受击腿及屏幕弯曲。法线与入射方向共同驱动承压；接近速度和质量仅在 ContactResponse 明确支持时使用，不虚构特殊技动量。

## 解析传导与支撑

`HitDynamics` 保存 20 个固定控制通道，每通道两组临界阻尼模态，延迟环固定 9 槽。直接部位压缩在命中当步可见，远端在 0–8 行动帧后由成对速度注入；到达时新增位移和速度均为零。最多保留三条可辨识接触描述，但淘汰描述不会删除身体已有位移、速度和待到达激励。

身体跟随真实战斗 root；脚用有限承重锚、卸载和回落目标，不把整个角色锁在命中世界位置。腿击优先释放实际受击侧，另一脚先承重；锚随后平滑释放，不能将不可达时的夹紧称为精确锁脚。护手从捕获姿势有限收回，不再进入统一甩臂曲线。八角色保留各自压缩、落脚和延迟参数。

渲染与捕获都走相同 owner 分支，绕过旧 hit 的 MotionGraph、Articulation、通用桥和 BodySupport 二次测脚。采样为纯读取，冻结不推进；已消费的 reaction 退出后不会重新叠到 idle。恢复或合法新动作先捕获当前完整 frame，再退休 episode；攻击肢体在原活动帧前准确交接。

## 骨架表示与实际限制

- `spatial3D`：未桥接的持久移动骨架，固定真实三维骨长，两骨求解。
- `legacyProjected`：旧出招等姿态保留源平面骨长和完整前向投影；前向 Jacobian 拟合关节角，不逆侧身 projector，也不将人工 depth 当作真实骨长。
- `resolvedSurfaceFallback`：桥输出无法由可信源绑定解释时保留显式降级和残差，采用有限局部传导，不能宣称固定真实三维骨架。退出跨表示同样报告 `chainMetrics`，截止帧目标整链优先。

手、头、发型、皮肤、扇和深度使用同一最终 frame。受击模型是有界的设计表现，并非人体物理，也不新增破防或额外硬直。当前未完成所有角色所有姿态的连续像素审看；侧向头部可读性是下一轮已识别问题。声音已有实际事件贯通，但未进行听审。

## 检查与历史

当前短检查：`tests/hit-episode/playable.py`、`appearance.py`，以及 `tests/hit-dynamics/unit.cjs`、`tests/hit-body-frame/unit.cjs`、`tests/frame-bridge/contact.cjs`。覆盖真实头腹腿、站立/出招/转身来源、四击保持同一载体、冻结纯读、恢复后轻拳活动帧整链精确。四连击使用公开的真实 contact API，报告明确它不是公共按键连段。互击/挑空快照由 `tests/hit-body/transaction.py` 验证。各报告绑定实际构建，不以早期声音报告冒充最终构建全测。

`HitBody` 的早期加法实现仅为兼容层；其 `tests/hit-body/playable.py` 等待旧 `_inkHitBody` 字段，已不适用于 episode 主路径。首次误用该旧探针的失败保存在 `qa/hit-body/retired-additive-probe.json`，不计为通过。`additive-baseline.json/png` 保留旧 clip 大甩臂的开发中间态；当前外观见 `qa/hit-episode/*-sheet.png`。
