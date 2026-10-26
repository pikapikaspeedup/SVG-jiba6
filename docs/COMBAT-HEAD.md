# Phase11：可读的战斗头像与表情

本轮把普通战斗中的头部显示从前脸／侧脸／后脑切换，改为连续的左右三分之四脸。它只改变显示，不修改战斗朝向、骨架长度、判定、资源或动作时序。角色向左时不再长期只显示后脑；中间方向保持正面厚度，不经过整头零宽度翻转。

## 三个模块

`CombatView.sample(f, frame, options)` 读取最终 VisualFrame，返回 `active`、`headViewAngle`、`bodyViewAngle`、`headMatrix`、`faceSide`、`profileWeight` 等显示参数。`faceSide` 为连续的 −1（左）至 +1（右），0 表示正面。`options.heading/bodyHeading` 可提供明确的弧度朝向；`preserveView` 可让出显示权。八角色拥有不同三分之四角度与厚度参数。

`CombatView.apply` 返回带 `combatView` 的 frame 副本。**原始 frame.headMatrix 保留不变**，显示矩阵只放在 `frame.combatView.headMatrix`；它保持原中心、竖轴和倾斜，以正行列式截面显示颅部。rig、joints、depth、materialAngles 没有被这层重写。普通空中动作也可使用该视图；投技、抓取、倒地、翻滚、复杂旋转等不适合路径使用原兼容显示。

`CombatExpression.sample(f, time)` 在冻结行动时钟上读取正式状态和已提交接触，返回连续 `head/body/leg/guard/brace/power` 权重，以及 `blink/gazeX/gazeY`。受击压低防守和发力表情；头腹腿使用不同权重入口。目光依据对手当前位置与高度，不预测对手输入，也不改变头骨或战斗朝向。眨眼由同一采样时钟决定，重复渲染不推进。

`CombatHead.markup(c)` 一次生成固定 SVG 部件；`CombatHead.sample(c,{look,mood})` 纯返回 `parts` 属性映射。renderer 按 `data-combat-head` 键缓存节点并更新路径、位置和不透明度。当前为 **25 个带键部件**，包含组节点；组内原发型和装饰可能有多个静态 path，因此 25 不是 SVG 总后代节点数。每帧不重写 innerHTML，不创建新节点。

## 形体、角色身份与表情

颅顶、颧面、下颌、耳、左右眼、鼻和嘴分别投影；左右眼宽度与可见性、鼻梁位置、下颌中心随 look 连续变化，不是整张脸贴图翻转。正面两眼保持分离，侧面仍有颅部体积。

隆保留尖发、红发带与胡茬；肯保留金发并独立重画额前和侧束，让出近眼；春丽保留双髻与白饰带；嘉米保留贝雷帽和面部标记；卢克保留短金发和疤痕；蛛俐保留双角发型与偏斜眉眼；舞保留高束发与红饰；八神保留红色长侧束，但额前、长束独立变化，左右近眼不再同时被刘海吞掉。

静态嘴为闭合线形，受击、咬紧和发力连续张开。眉斜率与眼型按角色区分，眼白不再描成完整的厚横框。虹膜在眼轮廓内小幅移动，缺省横向目光使用 look；闭眼时隐去虹膜。实际护拳仍可遮挡口鼻，这是身体与头部的真实显示遮挡，不能用把脸画到拳头前面来掩盖。

## Runtime 与 Renderer

Runtime 在普通 VisualFrame 最终接续之后追加 combatView；HitEpisode 自有受击 frame 也走同一个入口，再附加 CombatExpression 的 mood。Renderer 签名包含 combatView，避免表情变化被缓存跳过。视图 active 时采用显示头矩阵，更新 CombatHead，并隐藏旧表情／头视图；不适用时保留旧资产路径。发型附件沿显示头部基准接续，不改变正式手脚或颈根位置。

## 已执行证据及版本区别

初版 `qa/combat-head/playable.json` 绑定 HTML SHA 前缀 **8196dbfa20dfc566**，对应 `tests/combat-head/playable.py` 的八角色左右实际渲染、嘉米腹击 age 0／6，以及公共跳跃换边样本。左右显示矩阵均为正行列式，普通空中视图确实启用。跳跃采样中的战斗方向仍按正式规则保持，不能将此报告解释成“空中自动改向”。

初版图发现八神左刘海遮住双眼、眼眉横线感较重、静态嘴略呆。随后修改额前发束、眉眼与嘴形，加入有界目光。最新 `qa/combat-head/roster-update.json` 绑定 SHA 前缀 **7866ad41638a7771**，只重拍八角色左右头像；对比为 `roster-before.png` 和 `roster.png`。已通过 view_image 审看：八神、肯近眼重新可读，静态嘴闭合。**初版的腹击／跳跃检查没有在最新头像修订后全部重跑，不能合并声称最新版完整战斗检查全过。**

最终 HTML SHA 前缀 **87177afebc27e2f3** 的 `qa/combat-head/final-expression.json` 另行检查了实际腹击受击载体/新头像共同启用、冻结时重复采样不写战斗且表情稳定，页面无 JS 错误。此短检不等于全动作矩阵。源码门禁通过，707 原始资产保留。

`node tests/combat-head/unit.cjs` 覆盖八身份、左右与中间 look、连续表情、有限路径、输入不变、固定部件数量，以及目光与闭眼边界。几何单测不等于美术验收。

## 已知限制

当前头像是为战斗阅读设计的风格化二维面部，不是全部头发与五官的真实三维重建。肯和八神的新发束更图形化，仍有进一步细化空间。近身护手、发带和衣领可能遮挡局部五官；本轮有限图没有覆盖全部招式、极端角度与附件组合。复杂旋转和抓投兼容路径也不承诺与新头像无缝等价。只有明确绑定构建的报告代表相应检查，不能据此宣称所有动作无穿插。
