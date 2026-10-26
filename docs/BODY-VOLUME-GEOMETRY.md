# 动作中的关节体积与衣褶

SkinGeometry 保留原关节中心、肢体中心线和端点，仅生成覆盖这些骨架的表面。新增第四可选参数 `sampled(chain,widths,shape,surface)`，读取 Anatomy 的只读 `surface.foreshortening`。无元数据时按原长度处理，退化零长度仍返回 null 供既有 sweep 圆形回退。

八角色继续使用既有 morphology 的肌肉分布与关节衣料系数，而非统一增粗。屈曲时外侧保留圆撑、内侧压缩，最大外撑小于 26%、内收小于 34%；关节以外平滑衰减。投影短缩时半径最多收约 16%，保留截面厚度又避免短而过宽的板状轮廓。根部前几采样点按角色收约 7–12%接缝，中心不变。shade/light 的 band 使用同一左右轮廓半径，折弯区局部收窄，不再穿越实际内折边缘。

`folds(centerline,outer,isSkin)` 返回 `{crease,shade,opacity}`。肤面仅一条低透明屈曲线，布料三道压褶及短填色压缩面；伸直时透明度为零。隆/肯/八神的布料压缩厚于嘉米/舞的紧身或肤面，卢克前臂仍保留原有较厚的非均匀形态。路径为纯解析输出，没有时间、随机数或持久状态。

Renderer 接入建议：把 `rig.anatomy.surfaces[name]` 传给 sampled；已有 crease 节点使用 folds.crease/opacity。一个预建填色 path 位于 limb.details 的既有 surface clip 内，用 folds.shade/opacity，不用新增池、不新增模拟。原本骨段贴花和骨长源不变。

`node tests/body-volume/geometry.cjs` 检查 8 角色 × 双肢类型 × 4 屈曲角共 64 组合：有限路径、半径边界、输入纯度、中心线端点、伸直无压褶、八种不同腿部轮廓与零长度回退。正式画面与前后遮挡由 Runtime/Renderer 整合后检查，本模块不宣称精确人体体积守恒。
