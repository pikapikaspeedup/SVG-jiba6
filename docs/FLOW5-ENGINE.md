# FLOW 05 · 动作与特效引擎接口说明

适用版本：5.0.0。当前正式集成源为根目录 `game.js`；本文描述游戏实际调用的路径，不是单独研究样例。历史 `FLOW4-ENGINE.md` 保留用于比较。

## 1. 所有权和求值顺序

战斗模拟负责世界位置、动作帧、可取消状态、资源、判定和命中；新动作图负责最终表现层。`pose` 与 `visualPose` 必须保持分离。

```text
requestAnimationFrame(now)
  EngineClock.advance(now)
    0..8 个固定模拟步（60 Hz）
      输入/动作/战斗规则
      Runtime.tick → EventTimeline 的 start/end/cancel 边沿
      VFX.step → EmitterBank → 世界粒子/带状拖尾
  使用 alpha 采样显示帧
    CompiledClip / 原惯性交接 → 基础姿势 pose（规则输入）
    MotionGraph 分层 → 支撑脚目标约束 → 表现层交接 → visualPose
    IK → 身体/折扇/附件 SVG、挂点
    绘制世界粒子与拖尾，不推进年龄和发射序号
```

发射器自身也在固定模拟步内采样同一最终表现路径的挂点，而不是读取上次显示帧的 DOM 位置。DOM/CTM 只用于测试坐标一致性，不是战斗主循环依赖。

工坊 `state.pose`、`state.solved` 和控制点仍表示基础编辑轨；`state.visualPose` 表示显示修正后的结果。不要将最终姿势写回基本动作，否则会把叠加层反复烘焙进原资产。

## 2. 固定模拟时钟

`src/ink/engine-clock.js` 导出 `INK.SimulationClock` 与游戏单例 `INK.EngineClock`。

```js
const clock = new INK.SimulationClock({ hz: 60, maxSteps: 8, maxElapsed: 250 });
const alpha = clock.advance(nowMilliseconds,
  { active: true, paused: false, speed: 1 },
  () => simulateOneFrame());
const diagnostics = clock.inspect();
```

外部时间单位为毫秒，内部动作/粒子时间单位为 **模拟帧 F**。允许速度 0～4。`reset()` 丢弃积压，保留累计诊断。暂停、场景 active 切换、页面可见性变化不将后台经过的时间补算成攻击。

一次回调最多 8 步，输入时间最大接收 250ms；剩余整步被丢弃，`discardedSteps` 与 `clampedMs` 明确记录。它防止长卡顿后的无限追赶，不保证严重负载下墙钟时间和游戏时间一直一致，也不是网络同步或回滚时钟。

`inspect()` 返回 ticks、callbacks、lastSteps、alpha、discardedSteps、clampedMs、pauses、hz 和 pendingMs。不同显示调度下，额外 `renderFraction()` 不可改变 tick、伤害、输入缓冲年龄、事件和发射序号。

## 3. 编译关键帧采样

`CompiledClip` 继承原 `INK.Clip`，保持原 JSON 形状和 `sample(frame, base)` 返回姿势对象的接口。内部 `CompiledMotion.Track` 保存 Float64 时间、数值、分段三次系数，二分搜索所在段；单个返回姿势与原资源不共享可变数组。

保留 linear、smooth、strike、load、hold、单调 spline 和三次贝塞尔缓动；整招中的 360°/720° authored winding 不被折叠成最短弧。换招最短弧处理属于交接，不属于关键帧求值。

`Track` 是接收已验证轨道的内部数值构件；外部输入应先走 `INK.Schema.move` / `INK.validateClip` 或使用 `CompiledClip`，不要将任意未验证数组直接交给 Track。编译和求值本身不派发特效事件。

## 4. 动作图资产格式

新增可选 `clip.meta.motion5`；以下仅为该字段的示例，不是整份招式 JSON。帧必须落在所在招式实际时长内。

```json
{
  "version": 1,
  "weightScale": 1,
  "layers": [
    {
      "id": "torso-follow",
      "mode": "additive",
      "weight": [[0, 0], [8, 1, "smooth"], [30, 0, "smooth"]],
      "tracks": {
        "chestYaw": [[0, 0], [15, -10, "spline"], [30, 0, "spline"]],
        "fanAngle": [[0, 0], [16, 11, "spline"], [30, 0, "spline"]]
      }
    }
  ],
  "contacts": [
    {
      "id": "rear-support",
      "socket": "rearFoot",
      "start": 0,
      "end": 24,
      "fadeIn": 2,
      "fadeOut": 3,
      "strength": 0.85,
      "maxCorrection": 28
    }
  ],
  "springs": {
    "frequency": 0.34,
    "damping": 0.42,
    "hairStrength": 1,
    "clothStrength": 1
  }
}
```

最多 6 层，每层 1～12 条轨，ID 唯一。`weight` 可以是 0～1 数值或完整关键帧轨；`weightScale` 为全部层共同权重。按数组顺序执行，`additive` 加权增量，`override` 向目标混合。通道键就是遮罩，没有隐含的全身覆盖。

当前允许的显示通道为 lean、bob、head、chest、pelvis、headYaw、chestYaw、pelvisYaw、fan、fanAngle、ffoot、rfoot、fw、rw、fa、ra。rootX/rootY 等战斗位移通道被拒绝。fan 最终限制为 0～1。

每招最多 8 个接触窗口，同一只脚不可重叠；socket 只能为 frontFoot/rearFoot。strength 为 0～1，maxCorrection 为 1～60 像素，淡入/淡出不超过窗口一半。约束从窗口开始姿势获得参考挂点，将其转换到当前根变换下，限制修正长度，再交给两骨 IK。

这是 **有界目标修正**，不是强行变长的骨骼或完整重心求解。不可达目标、上限、淡入淡出均可能保留脚底漂移；空中禁用。实战根历史保留最近 40 个样本，本轮资产使用短支撑窗口；自定义很长的持续接触需另测，不能当作无限时长地形脚锁。

`INK.MotionGraph.compose(record, frame, basePose, profile, context, options)` 返回新姿势。`options` 包含 enabled、layers、contacts、springs；springs 开关供上层附件采样使用，不在 compose 内直接改人体轨。实战默认来自 `INK.MotionGraph.settings`；同帧窗口使用自己的一份局部开关，不改全局配置。

## 5. 连招交接

原基础轨的惯性交接继续存在。新增独立 `_inkVisualTransition`，在合法出招/取消时采样上一最终姿势与速度，承接被取消的叠加层偏移。

交接最长 5F，并受下一招 `startup - 1` 限制。到期限，位置和速度残差归零，不把上一招的手势留到下一招有效段。伤害仍使用基础规则路径，显示桥不改变攻击框。受击、格挡、倒地等反馈不套缓慢出招交接；常规回待机/收招可使用短时显示衔接。

这不是任意不同动作的 motion matching，也不意味着所有二阶加速度始终连续。快速取消与极端编辑仍应逐帧检视。

## 6. 附件弹簧链

`INK.SecondaryDynamics.stepSpring(position, velocity, target, omega, damping, dt)` 实现常目标步内的欠阻尼、临界与过阻尼解析积分。链的三个关节逐级跟随上一级，每个关节具有角度和角速度。

`sample(clipData, frame, enabled)` 使用每 0.5F 的不可变预采样结果做随机访问插值。由身体 yaw/spin/lean 的速度、加速度和 authored beats 驱动目标；不依赖上一次屏幕显示过哪一帧。返回 hairChain、clothChain、hair、cloth、twist、flutter、breath、velocity。

频率是每模拟帧的角频率尺度，不是 Hz。资产可配置 frequency 0.08～1、damping 0.1～2、两种强度 0～1.8；结果另有限幅。Mai renderer 用不同关节修正发辫和带子的分段曲线，而非将整条附件作为一块旋转。

预采样属于简化半物理附件系统，不含身体碰撞、自碰撞、真实质量分布或外部风场。目标主要来自基础角运动，不是任意新层/软体的全量耦合模拟。资源对象修改后要重新编译/失效缓存；工坊已接入该路径。预采样按招式独立，不代表跨所有取消都连续继承完整布料状态；表现姿势桥与附件动力状态是两件事。

## 7. 事件生命周期

`new INK.EventTimeline(events, { instance })` 接收 `{id,frame,duration,...}`。`advance(frame)` 只能向前；同帧再次调用不会重复派发；同一时刻 end 先于 start。返回的边沿具有 instance、serial、kind、frame、event。

`seek(frame)` 静默重建 active 集合，**不回放历史开始事件**。`cancel(reason)` 只关闭一次，返回 active 事件对应的 cancel 边沿。实战 `Runtime.tick` 是所有者，`EmitterBank` 消费这些边沿。渲染预览不调用模拟事件游标。

动作最多 32 个配置事件，同一帧最多 12 个形状特效，超出拒绝导入，不悄悄截掉作者事件。Runtime 当前 actionSerial 递增；`eventLog` 保留 160 个开始事件，`lifecycleLog` 保留 256 个生命周期条目。诊断日志有意有界，不是完整永久回放文件。

## 8. 发射器数据与单位

沿用每项 `fx` 事件的 particles 对象，新增字段可省略，旧资源有默认值。

```json
{
  "spacing": 13,
  "rate": 0.35,
  "burst": 3,
  "inheritVelocity": 0.25,
  "life": 30,
  "drag": 0.045,
  "gravity": -0.04,
  "species": "ember",
  "heat": true,
  "sizeCurve": [[0, 0.5], [0.15, 1.3], [1, 0]],
  "opacityCurve": [[0, 0], [0.1, 1], [0.75, 0.55], [1, 0]]
}
```

spacing 为沿挂点路径的像素间距（2～160）；rate 为每模拟帧的发射率（0～10）；burst 为首次出生数（0～32）；inheritVelocity 为挂点速度继承比例（0～1）。`count` 现在是旧资产的密度参考，而不是保证每事件恰好发出这么多粒子；显式 count=0 禁用该事件的粒子，但不等于禁用形状/拖尾。

世界坐标下距离和速度按实际缩放后的路径处理；局部预览用本地资产像素，角色整体缩放不同可能影响距离密度，不能承诺两者每一颗出生数完全相同。两者调用同一发射器数值内核，不是同一全局随机实例。

寿命为 F，速度为 px/F，重力为 px/F²，drag 为每 F 阻力系数。每条寿命曲线需 2～8 点，位置严格递增、首尾为 0 和 1；size 倍率 0～3，opacity 0～1，线性插值。heat 为余烬渐变，不是热力学模型。

`DistanceEmitter.advance(point, time, {quality,enabled})` 同时累积距离和时间余数。每小步最多 24 个出生候选；超额丢弃也推进序号，防止后续随机序列漂移。质量低时采用相同种子序列的子集。超过 280px 的单次位移视为传送，清空发射余数，不跨整屏画线。

实战 EmitterBank 用 0.5F 挂点采样，根历史用于补间移动；普通样本最多 8 个子段。粒子受独立世界容量控制，候选接受不等于最终入池。`INK.VFX.bank.stats` 记录 acceptedBirths、poolDrops、instances、eventEdges、cancelledActions；`FXEmitter.stats` 是运行时出生候选诊断，不能当作真实命中数。

## 9. 粒子与带状拖尾

含阻力运动采用位移因子 `(1-exp(-k*t))/k`，加速度项与其一致；k=0 使用弹道极限。反向显示只解析采样，不将时间倒着积分。显式零尺寸的圆环会隐藏，不产生除零 SVG 属性。

带状几何先做弧长重采样，再根据切向/法向生成有厚度的封闭轮廓与核心线。使用有界宽度及法向连续性；这不是一般多边形布尔运算或任意折线的严格 miter join。重复点、几乎零长度和折返做数值保护。

取消后关闭发射器/带状流，已有粒子按 life 衰减，已有带状点按记忆/寿命退场；命中定格时世界特效时钟不推进。低闪动与关闭效果仍沿用原设置，关闭后不会积压一批待补发粒子。

硬上限：世界粒子 320；单局部预览/演员粒子 144；世界带状流 64；每流最多 64 历史点、每次几何最多 64 重采样点；根历史 40；局部挂点缓存 2048。SVG 节点在池内复用，不用无限克隆 DOM。达到容量可能少画低优先级视觉，不得漏算战斗命中。

## 10. 编辑、迁移、调试

本轮新参数经过 Schema 校验、保存、Undo/Redo、重新加载与独立 HTML 再导出测试。retime 同步映射层轨、权重轨、接触起止和淡入淡出；寿命归一化曲线仍是 0～1，不按招式时长拉伸。

旧无 motion5 字段的招式按原轨道执行。导入旧记录不偷偷注入本轮舞的编排；它可能覆盖新层，须先备份。本次资产升级脚本 `tools/upgrade_mai_flow5.py` 是本轮迁移用，不应随意对已经编辑的资产反复执行来“重置风格”。

浏览器控制台可查看 `INK.EngineClock.inspect()`、`INK.MotionGraph.stats`、`INK.SecondaryDynamics.stats`、`INK.VFX.bank.stats`、`INK.Runtime.lifecycleLog`。首页同帧检视是更直接的观察入口；左侧基准只禁用新显示层，不是另一套旧游戏。

本轮数据、条件和实测边界见 `../TEST-REPORT-FLOW5.md`。不要从无头 Chromium 的 CPU 微基准推导真实手机/高刷新率显示器帧率。
