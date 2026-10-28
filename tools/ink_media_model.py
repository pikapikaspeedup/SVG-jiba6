#!/usr/bin/env python3
"""Capture a reference image/video as a bound INK vector skin and optional move.

Requires: Python 3.10+, mediapipe, opencv-contrib-python, numpy and ffmpeg.
The MediaPipe Pose Landmarker model is passed explicitly with --model. Video
inference is local. A source frame is quantized and traced into SVG paths; the
output contains no bitmap. A single view cannot supply hidden anatomy or a
true back view. Review the traced pieces and skeleton before using them.
"""
from __future__ import annotations
import argparse
import copy
import json
import math
import subprocess
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

ROOT = Path(__file__).resolve().parents[1]
VIDEO_SUFFIXES = {'.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'}
PARTS = ['torso', 'head', 'rearUpperArm', 'rearLowerArm', 'rearHand',
         'frontUpperArm', 'frontLowerArm', 'frontHand', 'rearUpperLeg',
         'rearLowerLeg', 'rearFoot', 'frontUpperLeg', 'frontLowerLeg', 'frontFoot']


def frame_at(path: Path, seconds: float) -> np.ndarray:
    if path.suffix.lower() not in VIDEO_SUFFIXES:
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError('无法读取图片')
        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(seconds), '-i', str(path), '-frames:v', '1',
           '-vf', 'scale=1600:-2', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1']
    data = subprocess.run(cmd, check=True, stdout=subprocess.PIPE).stdout
    if not data:
        raise ValueError('所选时间没有视频画面')
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('无法读取所选时间的画面')
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def landmarks(row, width, height):
    return np.asarray([[p.x * width, p.y * height, p.visibility or 0] for p in row], dtype=np.float32)


def select_pose(rows, target, previous=None):
    if not rows:
        return None
    def center(p):
        return ((p[23].x + p[24].x) * .5, (p[23].y + p[24].y) * .5)
    if previous is not None:
        distances = [(math.hypot(center(p)[0]-previous[0], center(p)[1]-previous[1]), i) for i, p in enumerate(rows)]
        distances.sort()
        if distances[0][0] > .24 or (len(distances) > 1 and distances[1][0]-distances[0][0] < .035):
            return None
        return distances[0][1]
    if target == 'left':
        return min(range(len(rows)), key=lambda i: center(rows[i])[0])
    if target == 'right':
        return max(range(len(rows)), key=lambda i: center(rows[i])[0])
    return max(range(len(rows)), key=lambda i: abs(rows[i][11].y - rows[i][27].y) + abs(rows[i][12].y - rows[i][28].y))


def detect_reference(image, model_path, target):
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.IMAGE, num_poses=3,
        min_pose_detection_confidence=.30, min_pose_presence_confidence=.30,
        output_segmentation_masks=True)
    with vision.PoseLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(image)))
        index = select_pose(result.pose_landmarks, target)
        if index is None or index >= len(result.segmentation_masks):
            raise ValueError('该画面没有识别到完整人物；换一个清晰全身画面或调整 --reference')
        mask = np.squeeze(result.segmentation_masks[index].numpy_view().copy())
        points = landmarks(result.pose_landmarks[index], image.shape[1], image.shape[0])
    return mask, points


def joints_from_pose(p):
    # The left/right labels are kept consistently from the reference image.
    # They are screen-space labels, not a claim of recovered 3-D handedness.
    a, b = (11, 12) if p[11, 0] <= p[12, 0] else (12, 11)
    pairs = {11: (13, 15, 23, 25, 27), 12: (14, 16, 24, 26, 28)}
    out = {'head': p[0, :2], 'neck': (p[11, :2]+p[12, :2])*.5}
    for side, shoulder in [('rear', a), ('front', b)]:
        elbow, wrist, hip, knee, ankle = pairs[shoulder]
        for name, idx in [('Shoulder', shoulder), ('Elbow', elbow), ('Hand', wrist), ('Hip', hip), ('Knee', knee), ('Foot', ankle)]:
            out[side+name] = p[idx, :2]
    return {name: [float(x) for x in point] for name, point in out.items()}


def distance_to_segment(xx, yy, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    t = np.clip(((xx-a[0])*dx+(yy-a[1])*dy)/max(1e-6, dx*dx+dy*dy), 0, 1)
    return np.hypot(xx-(a[0]+t*dx), yy-(a[1]+t*dy))


def partition(width, height, joints):
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    neck = np.asarray(joints['neck']);hip = (np.asarray(joints['rearHip'])+np.asarray(joints['frontHip']))*.5
    shoulder_width = max(8., np.linalg.norm(np.asarray(joints['rearShoulder'])-np.asarray(joints['frontShoulder'])))
    torso_width = max(height*.07, shoulder_width*.52)
    scores = [distance_to_segment(xx, yy, neck, hip)/torso_width]
    head = joints['head'];head_width = max(height*.06, shoulder_width*.42);head_height = max(height*.075, abs(neck[1]-head[1])*1.45)
    scores.append(np.sqrt(((xx-head[0])/head_width)**2+((yy-head[1])/head_height)**2))
    for side in ['rear', 'front']:
        for a, b, factor in [('Shoulder','Elbow',.035), ('Elbow','Hand',.030), ('Hand','Hand',.035)]:
            scores.append(distance_to_segment(xx, yy, joints[side+a], joints[side+b])/max(4., height*factor))
    for side in ['rear', 'front']:
        for a, b, factor in [('Hip','Knee',.055), ('Knee','Foot',.042), ('Foot','Foot',.043)]:
            scores.append(distance_to_segment(xx, yy, joints[side+a], joints[side+b])/max(4., height*factor))
    return np.argmin(np.stack(scores), axis=0).astype(np.uint8)


def vectorize(image, mask, points, character, colors):
    foreground = mask > .38
    ys, xs = np.where(foreground)
    if len(xs) < 200:
        raise ValueError('人物分割区域太小，请选择更清晰的全身画面')
    pad = max(8, int(max(xs.max()-xs.min(), ys.max()-ys.min())*.06))
    x0=max(0, int(xs.min())-pad);x1=min(image.shape[1], int(xs.max())+pad+1)
    y0=max(0, int(ys.min())-pad);y1=min(image.shape[0], int(ys.max())+pad+1)
    crop=image[y0:y1, x0:x1];crop_mask=foreground[y0:y1, x0:x1]
    factor=min(1., 512/max(crop.shape[:2]));width=max(16, round(crop.shape[1]*factor));height=max(16, round(crop.shape[0]*factor))
    crop=cv2.resize(crop, (width,height), interpolation=cv2.INTER_AREA)
    crop_mask=cv2.resize(crop_mask.astype(np.uint8), (width,height), interpolation=cv2.INTER_NEAREST)>0
    transformed=points.copy();transformed[:,0]=(transformed[:,0]-x0)*factor;transformed[:,1]=(transformed[:,1]-y0)*factor
    joints=joints_from_pose(transformed)
    ownership=partition(width,height,joints)
    pixels=crop[crop_mask].astype(np.float32)
    if len(pixels)<colors:
        raise ValueError('人物像素不足以生成色块')
    # Seeded and bounded, so repeated imports give the same palette.
    cv2.setRNGSeed(2237)
    _, labels, palette=cv2.kmeans(pixels, colors, None, (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER, 22, .8), 2, cv2.KMEANS_PP_CENTERS)
    color_index=np.full((height,width),-1,np.int16);color_index[crop_mask]=labels[:,0]
    palette=np.clip(np.rint(palette),0,255).astype(np.uint8)
    paths=[]
    for part, name in enumerate(PARTS):
        for color in range(colors):
            region=np.uint8((ownership==part)&(color_index==color))*255
            if not np.any(region):
                continue
            # Contours pass through pixel centres. A one-pixel overlap avoids
            # transparent cracks between adjacent colors and bone pieces.
            region=cv2.dilate(region,np.ones((3,3),np.uint8),iterations=1)
            region[~crop_mask]=0
            contours,_=cv2.findContours(region,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
            chunks=[];current=''
            for contour in contours:
                if len(contour)<3:
                    x,y=contour[0,0];path=f'M{x} {y}L{x+1} {y}L{x+1} {y+1}L{x} {y+1}Z'
                else:
                    simplified=cv2.approxPolyDP(contour,.65,True).reshape(-1,2)
                    if len(simplified)<3:
                        continue
                    path='M'+'L'.join(f'{x} {y}' for x,y in simplified)+'Z'
                if len(current)+len(path)>28000:
                    if current:chunks.append(current)
                    current=''
                current+=path
            if current:chunks.append(current)
            fill='#%02x%02x%02x'%tuple(palette[color])
            paths.extend({'part':name,'fill':fill,'d':d} for d in chunks)
    if not any(p['part']=='head' for p in paths) or not any(p['part']=='torso' for p in paths):
        raise ValueError('头部或躯干识别不完整，请换更清晰的画面')
    return {'version':1,'kind':'ink-vector-skin','character':character,'width':width,'height':height,
            'joints':{k:[round(v,2) for v in q] for k,q in joints.items()},'paths':paths}


def svg_text(skin):
    groups=[]
    for part in PARTS:
        content=''.join(f'<path d="{p["d"]}" fill="{p["fill"]}" fill-rule="evenodd"/>' for p in skin['paths'] if p['part']==part)
        groups.append(f'<g data-ink-part="{part}">{content}</g>')
    metadata=json.dumps({'kind':'ink-vector-skin-bind','version':1,'character':skin['character'],'joints':skin['joints']},ensure_ascii=False).replace('&','&amp;').replace('<','&lt;')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {skin["width"]} {skin["height"]}"><metadata>{metadata}</metadata>{"".join(groups)}</svg>'


def capture_motion(path, model_path, start, end, fps, target, crop=None):
    width,height=1280,720
    cmd=['ffmpeg','-v','error','-ss',str(start),'-i',str(path),'-t',str(end-start),'-an','-vf',f'fps={fps},scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2','-f','rawvideo','-pix_fmt','rgb24','pipe:1']
    proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    opts=vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=str(model_path)),running_mode=vision.RunningMode.VIDEO,num_poses=3,min_pose_detection_confidence=.30,min_pose_presence_confidence=.30,min_tracking_confidence=.45)
    rows=[];previous=None;size=width*height*3
    try:
        with vision.PoseLandmarker.create_from_options(opts) as detector:
            index=0
            while True:
                data=proc.stdout.read(size)
                if not data:break
                if len(data)!=size:raise ValueError('视频解码中断')
                frame=np.frombuffer(data,dtype=np.uint8).reshape(height,width,3).copy()
                if crop:
                    x0,y0,x1,y1=crop;frame=frame[round(y0*height):round(y1*height),round(x0*width):round(x1*width)].copy()
                result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=frame),round(index*1000/fps))
                chosen=select_pose(result.pose_landmarks,target,previous)
                if chosen is None:
                    rows.append(None)
                else:
                    raw=result.pose_landmarks[chosen];previous=((raw[23].x+raw[24].x)*.5,(raw[23].y+raw[24].y)*.5)
                    p=landmarks(raw,frame.shape[1],frame.shape[0]);important=p[[11,12,13,14,15,16,23,24,25,26,27,28],2]
                    rows.append(p if np.count_nonzero(important>.35)>=9 else None)
                index+=1
    finally:
        proc.stdout.close();stderr=proc.stderr.read().decode('utf-8','replace');code=proc.wait()
    if code:raise ValueError('视频解码失败：'+stderr[-500:])
    valid=sum(p is not None for p in rows)
    if len(rows)<3 or valid/len(rows)<.8:raise ValueError(f'动作识别覆盖不足：{valid}/{len(rows)} 帧；请换无遮挡片段或缩小时间范围')
    max_gap=gap=0
    for p in rows:
        gap=gap+1 if p is None else 0;max_gap=max(max_gap,gap)
    if max_gap>max(1,round(fps*.20)) or rows[0] is None or rows[-1] is None:
        raise ValueError(f'动作存在过长的遮挡或缺帧（最长 {max_gap} 帧），未生成动作，请缩短片段')
    # Only short interior gaps are interpolated; never extend lost endpoints.
    for i,p in enumerate(rows):
        if p is not None:continue
        a=i-1
        while rows[a] is None:a-=1
        b=i+1
        while rows[b] is None:b+=1
        rows[i]=rows[a]+(rows[b]-rows[a])*((i-a)/(b-a))
    return rows,valid


def move_from_capture(rows, character, move_id):
    path=ROOT/'assets'/'ink'/'characters'/character/'moves'/(move_id+'.json')
    if not path.exists():raise ValueError('找不到现有招式 '+str(path))
    move=json.loads(path.read_text(encoding='utf-8'));duration=move['clip']['duration'];tracks={k:[] for k in ['rw','fw','ra','fa','lean','bob']}
    first=rows[0];rear_is_left=first[11,0]<=first[12,0]
    rear=(11,13,15,23,25,27) if rear_is_left else (12,14,16,24,26,28)
    front=(12,14,16,24,26,28) if rear_is_left else (11,13,15,23,25,27)
    for i,p in enumerate(rows):
        hip=(p[23,:2]+p[24,:2])*.5;neck=(p[11,:2]+p[12,:2])*.5
        torso=neck-hip;span=float(np.linalg.norm(torso))
        if span<8 or torso[1]>span*.2:raise ValueError('人物翻转或躯干被遮挡，不能可靠映射到直立骨架')
        scale=float(np.clip(132/span,.08,5))
        lean=math.degrees(math.atan2(float(torso[0]),float(-torso[1])))
        if abs(lean)>70:raise ValueError('躯干侧转过大，请缩短片段或手动校正')
        ground=max(float(p[27,1]),float(p[28,1]));bob=float(np.clip(191-(ground-hip[1])*scale,-10,90))
        def pt(index,arm=False):
            q=(p[index,:2]-hip)*scale+np.array([0,-191+bob])
            if arm:
                angle=math.radians(-lean);x,y=float(q[0]),float(q[1]+181-bob)
                q=np.array([math.cos(angle)*x-math.sin(angle)*y,math.sin(angle)*x+math.cos(angle)*y-181])
            return [round(float(np.clip(q[0],-400,400)),2),round(float(np.clip(q[1],-440,160)),2)]
        t=round(i*duration/max(1,len(rows)-1),3)
        for name,value in [('rw',pt(rear[2],True)),('fw',pt(front[2],True)),('ra',pt(rear[5])),('fa',pt(front[5]))]:tracks[name].append([t,value,'smooth'])
        tracks['lean'].append([t,round(lean,2),'smooth']);tracks['bob'].append([t,round(bob,2),'smooth'])
    for name,keys in tracks.items():
        for a,b in zip(keys,keys[1:]):
            delta=float(np.linalg.norm(np.asarray(a[1])-np.asarray(b[1])))
            limit=45 if name=='lean' else 60 if name=='bob' else 120
            if delta>limit:raise ValueError(f'{name} 关键点相邻帧跳变 {delta:.1f}，可能跟丢或识别到对手；请重新截取并人工校正')
    for name,keys in tracks.items():move['clip']['tracks'][name]=keys
    move['name']=move['name']+' · 视频动作参考'
    return move


def main():
    parser=argparse.ArgumentParser(description='从图片或视频生成可绑定的 INK SVG 分件；视频可另提取一个动作。')
    parser.add_argument('source',type=Path);parser.add_argument('--model',type=Path,required=True,help='MediaPipe pose_landmarker_full.task 路径')
    parser.add_argument('--character',default='mai',choices=['ryu','ken','chun','cammy','luke','juri','mai','iori'])
    parser.add_argument('--reference',type=float,default=0,help='视频中用于建模的秒数')
    parser.add_argument('--target',choices=['left','right','largest'],default='largest')
    parser.add_argument('--colors',type=int,default=24,choices=range(8,49));parser.add_argument('--out',type=Path,required=True,help='输出模型 JSON 路径；旁边生成 SVG')
    parser.add_argument('--start',type=float);parser.add_argument('--end',type=float);parser.add_argument('--fps',type=int,default=12,choices=range(4,31))
    parser.add_argument('--motion-crop',help='动作人物范围：左,上,右,下（各为 0–1），可减少对手干扰')
    parser.add_argument('--move',default='sMP',help='映射到已有角色招式文件，如 sMP、sHK')
    parser.add_argument('--motion-out',type=Path,help='可选：输出映射到现有招式的 JSON')
    args=parser.parse_args()
    if not args.source.is_file() or not args.model.is_file():parser.error('源文件或姿态模型不存在')
    if args.out.suffix.lower()!='.json' or args.motion_out and args.motion_out.suffix.lower()!='.json':parser.error('输出文件必须使用 .json 扩展名')
    outputs=[args.out,args.out.with_suffix('.svg')]+([args.motion_out] if args.motion_out else [])
    if len({p.resolve() for p in outputs})!=len(outputs) or args.source.resolve() in {p.resolve() for p in outputs} or args.model.resolve() in {p.resolve() for p in outputs}:parser.error('输出文件不能与源文件、姿态模型或其他输出重名')
    if not math.isfinite(args.reference) or args.reference<0:parser.error('参考时间必须为非负数')
    if args.motion_out and (args.source.suffix.lower() not in VIDEO_SUFFIXES or args.start is None or args.end is None or args.start<0 or args.end<=args.start or args.end-args.start>15):parser.error('动作输出需要视频及不超过 15 秒的有效 --start / --end')
    crop=None
    if args.motion_crop:
        try:crop=tuple(map(float,args.motion_crop.split(',')))
        except ValueError:parser.error('--motion-crop 需要四个 0–1 数值')
        if len(crop)!=4 or not all(0<=v<=1 for v in crop) or crop[2]-crop[0]<.1 or crop[3]-crop[1]<.1:parser.error('--motion-crop 需要有效的左、上、右、下边界')
    try:
        image=frame_at(args.source,args.reference);mask,points=detect_reference(image,args.model,args.target)
        skin=vectorize(image,mask,points,args.character,args.colors)
        motion=None;valid=0;total=0
        if args.motion_out:
            rows,valid=capture_motion(args.source,args.model,args.start,args.end,args.fps,args.target,crop);total=len(rows)
            motion=move_from_capture(rows,args.character,args.move)
            motion['clip'].setdefault('meta',{})['capture']={'source':args.source.name[:150],'start':args.start,'end':args.end,'fps':args.fps,'frames':total,'detected':valid,'retimed':True,'target':args.target,'crop':list(crop) if crop else None}
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(json.dumps(skin,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        args.out.with_suffix('.svg').write_text(svg_text(skin),encoding='utf-8')
        if motion:
            args.motion_out.parent.mkdir(parents=True,exist_ok=True);args.motion_out.write_text(json.dumps(motion,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        print(f'模型: {args.out}；SVG 路径: {len(skin["paths"])}；画布: {skin["width"]}×{skin["height"]}')
        if motion:print(f'动作: {args.motion_out}；可识别 {valid}/{total} 帧；动作按现有招式时长重定时')
        print('请检查人物身份、骨点、遮挡和分件；单张画面无法还原背面或被挡住的部位。')
    except (ValueError, subprocess.CalledProcessError, OSError) as exc:
        print('生成失败：'+str(exc),file=sys.stderr);return 1
    return 0

if __name__=='__main__':
    raise SystemExit(main())
