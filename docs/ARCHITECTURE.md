# INK FORGE 2 — 开发接入说明

## 一条数据通路

```text
独立 JSON 模型 / 骨架 / 动作
    → Schema.bundle / model / rig / move 校验
    → AssetStore（默认包 + 修改覆盖，修订号）
    → 编辑器与 Runtime 共用
    → Clip.sample → Rig.solveAnimation
    → Renderer / socket 碰撞框 / Effects
```

编辑器没有另外写一份近似的招式表演。`testMove()` 先提交同一个 `AssetStore`，再调用原对战 `SVG_FIGHTER.practice()`；状态与双人动作走 `State` 的明确映射。

## 文件属于谁

`model.json`：肢体轮廓宽度、头部比例、胸腰髋横向修形、名字与强调色。

`rig.json`：四段绑定骨长、前后肩坐标、髋宽、头部偏移。骨长由 IK 保持；作者指定的投影缩短不改绑定长度。

`moves/*.json`：动画轨道、三阶段时序、受击/攻击框、FX 事件、来源与旧战斗 ID。

`src/ink/art/<id>.js`：发型轮廓、角色装饰、正背服装。用同一套 P/F/L 路径助手生成原始 SVG，之后由渲染器根据骨架变形。不要在这里修改战斗状态。

`runtime.js` 与 `states.js`：游戏语义桥。不要把网页按钮、文件选择器、保存逻辑放进这两层。

`project.js`：JSON 数据的唯一发布入口。保存时先验证整份修改，成功写入持久层后才更新可见版本；在内存模式会明确标识为非持久。读目录则先暂存全部有效文件，再进行一次工程导入。

## 关键接口（实际存在）

```js
// 在创作版的浏览器控制台使用；修改的是当前应用，不是远程仓库。
await INKForge.route('studio');
await INKForge.loadMove('mai', 'hishou-ryuuenjin-light');
INKForge.atFrame(5);
const pose = structuredClone(INKForge.state.pose);
pose.fw[0] += 16;
INKForge.writePose(pose);
await INKForge.save();
await INKForge.testMove();
```

直接操作数据仓库时，也必须复制再保存，不要原地修改 `getMove()` 返回的对象：

```js
const store = INKForge.store;
const original = store.byGame('mai', 'ryuenbu_0');
const draft = INK.Schema.clone(original);
draft.fx[0].color = '#ef995a';
await store.save({ motion: draft });
```

时序修改使用统一函数，而不是只修改一个数值：

```js
const retimed = INK.retime(draft, 10, 20, 24);
// 会更新关键帧、FX、事件与判定区间；不自动改变伤害或世界位移。
await store.save({ motion: retimed });
```

编辑器自身的 `state.draft` 是工作草稿，仓库保存后外部直接修改资产时，应通过 `loadMove()` 重新打开，否则旧草稿再次保存可能覆盖外部修改。当前没有跨标签页实时协作与自动冲突合并。

## 坐标与时间

局部地面在 y≈0，脚踝通常 y=-16，骨盆约 y=-191，胸部约 y=-295；y 向下。`fw/rw` 是躯干局部手腕目标，`fa/ra` 是角色局部脚踝目标。`lean/chest/pelvis/head` 使用角度。

整体 `spin`、`depth`、镜像与角色位移在人物外层完成。骨架解算产生局部挂点，判定框四角再由同一世界变换求外接 AABB。这里没有把 CSS 屏幕像素当战斗坐标。

每个招式 `duration = startup + active + recovery`。阶段采用 `[0,s]、[s,s+a]、[s+a,total]` 的端点定义；攻击框和 FX 生存期判断使用半开区间。按三阶段映射，而不是按整个招式总长度等比缩放，以保持视觉接触与战斗有效帧对齐。

命中定格冻结模拟中的招式帧；FX 根据该帧计算，不依赖随机的真实时间。`Runtime.tick()` 维护每次攻击的事件游标，重复求同一帧不会再派发一次。

行走绑定步态周期；跳跃结合真实竖直速度；受击、倒地与起身以状态年龄推进。双人投技动画在原有握持与释放规则内采样，不替换受害者的世界位置约束。

## SVG 渲染与性能

连续肢体外轮廓覆盖分段骨架，内部明暗经过相同轮廓裁切。胸腹使用绑定区域的加权路径变形；头部和服装前背视图切换独立于动作数据。

每个宿主 SVG 有自己的渐变定义和唯一前缀，不能依赖另一个隐藏 SVG 中的渐变 ID。首次构建之后复用路径节点；`Renderer.render()` 跳过完全一致的姿势。FX 固定十二槽，同帧超额会报错。

计算不是全程零分配：采样、骨架、控制点和部分编辑覆盖层仍创建短期对象。`stats.cpuMs` 不包括浏览器之后的 paint，不应标注为完整帧耗时。

## 明确不做的事情

工坊不接受执行任意 JavaScript 的动作文件，不从用户 JSON 注入 SVG markup，也不执行来自 FX 的伤害代码。新增一个全新的游戏动作身份，还需要规则层、输入映射和清单更新；现有 UI 主要编辑已绑定条目，不是任意新增角色/招式的通用引擎编辑器。

导出玩家版只改变展示入口，不是安全沙箱或源码加密。文件仍然是可检查的普通 HTML。

原有格斗规则层有意保留为兼容基线；本轮解耦的是制作/资源/动画/渲染通路，不宣称整个战斗模拟已经改成全新的 ECS、网络回滚或第三方通用引擎。
