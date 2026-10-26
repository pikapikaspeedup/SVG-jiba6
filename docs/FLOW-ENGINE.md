# FLOW 03 引擎实现与制作接口

## 时间域与补间

SVG 是矢量场景格式，不要求存储一张张完整画面。本项目的“补帧”是对关键帧的数值、骨架与外形连续采样，而不是对屏幕截图运行光流。画面时间与游戏模拟时间明确分开。

战斗沿用 60 Hz 固定模拟。渲染沿模拟帧 `t-1+alpha` 采样动作，位置沿前后模拟位置插值。在攻击切换、暂停、命中定格时，显示当前确定姿势；定格不消耗招式进度。渲染采样不发出战斗事件，不写血量或斗气。

`INK.sampleTrack(keys, frame)` 通过二分查找当前区间。第三字段 `spline` 启用单调三次 Hermite：两侧割线同号时用按区间加权的调和切线，局部极值切线为零，区间输出限制在端值包络。`hold` 保持上一姿势，`strike` 与 `load` 保留发力/蓄势曲线，不把所有东西滤成慢悠悠的正弦。完整转身写为 0→90→180→270→360，不在单个动作内折叠成最短角度。

```js
const track = [[0, 0], [8, 35, 'spline'], [17, 180, 'spline'], [42, 360, 'spline']];
const angle = INK.sampleTrack(track, 12.5); // 允许小数帧，纯采样
const pose = new INK.Clip(move.clip).sample(12.5);
```

启动另一招时，`Runtime.capture/sample` 最多混合 3 个起手帧，且在有效帧前完成。它混合数值姿势而非角色图片，新的接触姿势不会因为显示平滑而延后。`SVG_FIGHTER.renderFraction(alpha)` 是诊断接口，只更新显示；进入 hitstop 后不同 alpha 必须得到同一接触姿势。

## 轴向转身与遮挡

`yaw` 是全身轴向角度，`headYaw/chestYaw/pelvisYaw` 是各分区相对偏移；`spin` 仍表示画面平面内的翻滚，不能混为一谈。

`INK.Turn.view(angle)` 返回正/侧/背权重、肩髋投影与厚度。厚度采用 `sqrt(cos²(angle) + 0.42*sin²(angle))`，避免侧身变成零宽纸片。肩部投影在侧身穿越前后深度。`INK.Turn.bands(angle, halfWidth)` 生成严格拼合、互不重叠的裁剪条带；衣装正/侧/背在不透明区域呈现。没有两个半透明面孔同时漂浮的问题。

这不是三维网格旋转。中间侧面是手写轮廓与投影，极端视角仍受原美术素材限制；八人不同服装的完整多角度手绘替换库仍可继续扩充。任意不兼容 SVG 路径也不能凭空正确变形。

## 粒子类 API

```js
const system = new INK.Particles.ParticleSystem(svgGroup, {
  capacity: 160,
  quality: 1
});
system.emit({
  x: 200, y: 240, frame: 12,
  seed: INK.Particles.hash('ken:shoryu:hit1'),
  count: 24, material: INK.Particles.materials.ken,
  angle: -45, spread: 100, direction: 1,
  speed: 5, life: 24, size: 2.8,
  species: 'ember'
});
system.step(13);       // 回收过期项；模拟职责
system.render(13.25);  // 解析位置和透明度；显示职责
system.clear();
system.destroy();
```

坐标为 SVG user units，速度为单位/帧，寿命为 60 Hz 帧，重力为单位/帧²。阻力积分使用 `(1-exp(-k*age))/k`，叠加重力二次项。随机量由 seed+粒子索引得到，不使用每次绘制随机数。缩放、透明度、旋转随年龄确定。对象池固定 SVG 节点上限，满池会计数 dropped 并舍弃新增请求；不是零分配渲染承诺。

### 动作资产中的发射器

```json
{
  "id": "shoryu-flame",
  "type": "flame",
  "socket": "frontHand",
  "frame": 6,
  "duration": 17,
  "color": "#ff8244",
  "scale": 1.2,
  "rotation": -90,
  "opacity": 0.8,
  "particles": {
    "species": "ember",
    "count": 64,
    "life": 27,
    "speed": 4.2,
    "size": 2.8,
    "spread": 85
  }
}
```

这是结构示例，不是官方招式时序。发射器保存在 `move.fx[]`；数量、时长、种类和挂点由 schema 验证。编辑器和实战共享 `INK.Effects`。

`Effects.render(record, frame, pose, rig, context?)` 以当前帧反推出仍存活粒子的出生帧，反向拖动也能复现可见 SVG。轨迹采样先量化到 0.25 帧再计算并缓存，避免同一 cache key 因不同访问顺序落到不同位置。13 个历史采样点构成带宽曲线，火焰/丝带/旋风/三爪/冲击波有不同轮廓分支。上升火焰沿肘→拳或膝→脚包裹。

实战 `VFX.captureRoots` 在移动和命中模拟后按攻击实例保存最多 40 个根位置历史，拖尾可以脱离当前手脚位置，保留突进之前的世界坐标。世界池负责真实命中、格挡、落地烟尘、冲刺碎片和弹体尾焰；它不因换招被立即删除。工作台没有实际战斗世界位移，使用本地骨架轨迹，不伪造移动距离。

每角色局部池 144 个，世界池 320 个。低/标准/高档为 0.5/1/1.5 倍请求数量，上限始终固定。`stats.active/peak/dropped/capacity` 供诊断。命中大光盘已从新渲染关闭，保留小的真实接触亮核，使人物轮廓可读。

## 连段路线是规则，不是逐步扣血脚本

`assets/ink/combos.json` 的 `routes[]` 对象保存：

```json
{
  "id": "custom-confirm",
  "character": "ken",
  "corner": true,
  "distance": 166,
  "meter": {"drive": 6, "super": 3},
  "steps": [
    {"move": "sHP", "minHits": 1},
    {"move": "RUSH", "minFrames": 5},
    {"move": "sMP", "minHits": 1},
    {"move": "jinrai_3", "minHits": 1},
    {"move": "SA3", "minHits": 8}
  ],
  "expectedHits": 11,
  "minTotal": 11
}
```

以上仅展示字段，不额外计入 16 条已验证路线。改路线后运行实际验证，而不是凭预期数字判断成立。

`INK.Combo.start(route, 'demo'|'practice', options)` 只在开局设置位置和资源；随后演示只发起 `SVG_FIGHTER.tryMove` 正常请求。`onMove` 验证顺序和上一步最低命中，`onCombat` 记录真实 hit/block/parry、伤害和连续计数。首击后将木桩策略设为 guard，恢复可行动就会挡住不成立的衔接。内部不追加硬直，不改攻击距离，不瞬移追人，不在播片中伪造累计伤害。

G 节奏模式也必须收到实际用户输入；它省略动作指令输入，不省略时机和资源。辅助/经典模式则保留原输入系统。演示能够择时，不等于自动示范验证了人手全部搓招；另外有真实 DOM 键盘、两指触摸和错误输入测试。

`summary()` 导出每步开始帧、实际命中和伤害、总数、初始/剩余资源、成功或失败原因。完成时固定最终资源快照，避免等待后斗气回充污染成绩。`trace` 保存真实阶段；显示最近 200 个模拟帧，不把命中定格重复计入动作时间。

旧计数器对已恢复木桩有十 tick 宽限，这一构建移除了该宽限。底层 `game.js` 不改写；修改在唯一锚点构建接入层中明确呈现。基础伤害和时序没有为了连段验证而改大。

## 源码模块

| 文件 | 职责 |
|---|---|
| `src/ink/core.js` | 数学、IK、轨道、分段插值 |
| `src/ink/inbetween.js` | 转向、投影、opaque view bands |
| `src/ink/renderer.js` / `design.js` | 保留式 SVG、轮廓、衣装侧视 |
| `src/ink/particles.js` | 可复用粒子池与解析轨迹 |
| `src/ink/effects.js` | 角色发射器、骨骼拖尾、世界接触粒子 |
| `src/ink/combo.js` | 基于真实状态的连段控制和验证 |
| `src/ink/cinema.js` | 训练厅宽景与镜头，不改碰撞 |
| `forge/flow.js` / `flow.css` | 跟练、节奏提示、手机布局 |
| `tools/build_forge.py` | 源码到自包含 HTML、唯一锚点接入 |
| `tools/check_flow.py` | 全套数值、浏览器、战斗、触屏回归 |

## 研究依据与实现取舍

- W3C SVG 2 / Paths，https://www.w3.org/TR/SVG2/paths.html ：兼容命令结构的路径可以对参数连续插值，不兼容结构不可指望自动平滑。这里对骨架数值与作者定义视图插值，不声称任意 SVG 自动拓扑匹配。
- MDN Window.requestAnimationFrame，https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame ：显示回调通常跟随刷新率，必须依据时间而非回调次数推进。这里固定逻辑与分数帧显示分离。
- Esoteric Software / Applying Animations，https://esotericsoftware.com/spine-applying-animations ：动画采样、过渡与事件是不同职责。这里只借鉴工程分层，不包含 Spine 运行时或商业素材。

上述资料于 2026-09-12 查阅。官方 SF6 招式帧数、三维模型、碰撞数据并未被此研究导入。全局回滚同步、跨浏览器基准和完整多角度美术资产不在本版已实现范围。
