# 接触声音与短视觉响应

本轮由真实 contact 事件驱动声音与接触形状。普通地面受击的身体由 HitEpisode 接管；这里的变化只涉及 StrikeFeel 音频计划和 ImpactFeedback 的有限粒子调用，不改判定、伤害、命中停顿、默认速度或全局密度。

`StrikeFeel.contactSound(context)` 是纯采样，接收已提交的 response 与世界 incoming。质量和接近速度只有 response.affectsPush 为真时标记 measured；特殊技默认质量与零接近速度不冒充实测动量。incoming 与碰撞 normal 的夹角决定斜切程度，低质量边缘接触表现为擦中。法向不替代真实击打来向。

音频仍在原 6 voice 池中每次接触占一个 voice，固定最多三层：短接触瞬态、稍迟的身体低频、材质余音。头部较清脆、腹部低频更深、腿部延迟略大；擦中减少低频，斜切增加薄余音。多段中间击缩短余音，防御、招架、霸体和投技保留可辨认的专用音色。该参数设计仍需要实际听审，纯数值检查不能替代听感判断。

ImpactFeedback 优先使用共同快照 incoming；缺失时用 Rig.world 的实际链两点差。旧实现直接对 actor-screen 链差再乘 dir，会令左向重复反射，本轮去除该路径。normal 只定接触表面的角度与斜率分类。

普通与多段中间接触通常一个主形，特殊末击最多两个，材质尾屑最多两个；简化运动模式保留单主形。该模块不再追加大圈。原世界粒子容量 320、其他模块的光与轨迹池不变，不能把本模块的数量上限误写成全场总粒子数。

`tests/contact-sense/unit.cjs` 覆盖八材质、三个部位、五种结果的音频有限性与纯度，以及扎实/擦中/斜切形状、左向世界方向、简化模式边界。正式碰撞贯通与实际听审在统一构建后另行记录。

统一构建后的有限实测见 `qa/contact-sense/playable.json`：真实 sLP/sHP/sMP 接触分到 body，cMK 分到 leg，波动拳为 presentation-only / measured=false。向左中拳与飞行道具的 incoming 和 Impact 角度一致；音频开启后普通接触只出现一个 hit/heavy voice（其中含三层），波动拳还保留发射时独立 wave voice，capacity 仍为 6。未获得真实 head 接触样本，不能把三种部位单测称为实际头部命中覆盖。

`qa/contact-sense/contact-plans.wav` 为捕获的真实音频计划经 OfflineAudioContext 依次合成，使用确定性噪声和单声道。它不是游戏 master/compressor/limiter 输出的现场录音，也未进行人工听审；仅可用作后续短试听素材。

补充真实头部样本：`tests/contact-sense/head.py` 按公共跳跃＋LP输入命中地面目标，`qa/contact-sense/head.json` 独立绑定构建。结果 zone=head、measured=false（空中普通技不冒用地面质量），三层计划共享一个 hit voice，容量仍为 6。`head-plan.wav` 同样是计划的离线 WebAudio 合成，非真实 master 输出录音，未听审；原五例未重复运行。

接触光改为沿实际来向的局部椭圆，身体内光优先实际受击者；向左冲刺残影移除 actor-screen 的重复镜像。组合短检见 `qa/contact-sense/composition.json`，仍绑定其早期整合构建。
