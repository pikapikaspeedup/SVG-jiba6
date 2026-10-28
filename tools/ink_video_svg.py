#!/usr/bin/env python3
"""Trace a short video segment into a self-contained animated SVG.

Each captured frame is an independent set of colored SVG paths. It is a
flipbook reference, not a skeletal rig, collision model, or 3-D reconstruction.
The file contains no embedded raster or video. Requires the same optional local
dependencies and pose model as ink_media_model.py, plus ffmpeg.
"""
from __future__ import annotations
import argparse
import html
import math
import subprocess
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from ink_media_model import select_pose


def capture(path,model,start,end,fps,target,crop,limit):
    width,height=1280,720
    cmd=['ffmpeg','-v','error','-ss',str(start),'-i',str(path),'-t',str(end-start),'-an',
         '-vf',f'fps={fps},scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2',
         '-f','rawvideo','-pix_fmt','rgb24','pipe:1']
    proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    opts=vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=str(model)),
        running_mode=vision.RunningMode.VIDEO,num_poses=3,min_pose_detection_confidence=.30,
        min_pose_presence_confidence=.30,min_tracking_confidence=.45,output_segmentation_masks=True)
    frames=[];previous=None;size=width*height*3
    try:
        with vision.PoseLandmarker.create_from_options(opts) as detector:
            index=0
            while True:
                raw=proc.stdout.read(size)
                if not raw:break
                if len(raw)!=size:raise ValueError('视频解码中断')
                picture=np.frombuffer(raw,np.uint8).reshape(height,width,3)
                if crop:
                    x0,y0,x1,y1=crop;picture=picture[round(y0*height):round(y1*height),round(x0*width):round(x1*width)]
                picture=np.ascontiguousarray(picture)
                result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=picture),round(index*1000/fps))
                chosen=select_pose(result.pose_landmarks,target,previous)
                if chosen is None or chosen>=len(result.segmentation_masks):
                    raise ValueError(f'第 {index+1} 帧人物跟踪失败；请缩短片段或调整裁剪范围')
                pose=result.pose_landmarks[chosen];previous=((pose[23].x+pose[24].x)*.5,(pose[23].y+pose[24].y)*.5)
                mask=np.squeeze(result.segmentation_masks[chosen].numpy_view().copy())>.38
                area=float(mask.mean())
                if area<.015 or area>.75:raise ValueError(f'第 {index+1} 帧的人物分割不可靠')
                scale=min(1.,limit/max(picture.shape[:2]));w=max(16,round(picture.shape[1]*scale));h=max(16,round(picture.shape[0]*scale))
                picture=cv2.resize(picture,(w,h),interpolation=cv2.INTER_AREA)
                mask=cv2.resize(mask.astype(np.uint8),(w,h),interpolation=cv2.INTER_NEAREST)>0
                frames.append((picture,mask));index+=1
    finally:
        proc.stdout.close();stderr=proc.stderr.read().decode('utf-8','replace');code=proc.wait()
    if code:raise ValueError('视频解码失败：'+stderr[-500:])
    if len(frames)<2:raise ValueError('片段少于两帧')
    return frames


def palette_for(frames,count):
    samples=[]
    for image,mask in frames:
        px=image[mask];step=max(1,len(px)//3000);samples.append(px[::step].astype(np.float32))
    points=np.concatenate(samples)
    if len(points)<count:raise ValueError('人物像素不足')
    cv2.setRNGSeed(2237)
    _,_,centers=cv2.kmeans(points,count,None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,20,.8),2,cv2.KMEANS_PP_CENTERS)
    return np.clip(np.rint(centers),0,255).astype(np.uint8)


def trace_frame(image,mask,palette):
    points=image[mask].astype(np.float32)
    _,nearest=cv2.batchDistance(points,palette.astype(np.float32),cv2.CV_32F,K=1)
    labels=np.full(mask.shape,-1,np.int16);labels[mask]=nearest[:,0]
    paths=[]
    for color in range(len(palette)):
        region=np.uint8(labels==color)*255
        if not np.any(region):continue
        region=cv2.dilate(region,np.ones((3,3),np.uint8),iterations=1);region[~mask]=0
        contours,_=cv2.findContours(region,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
        chunks=[];current=''
        for contour in contours:
            if len(contour)<3:
                x,y=contour[0,0];path=f'M{x} {y}L{x+1} {y}L{x+1} {y+1}L{x} {y+1}Z'
            else:
                points=cv2.approxPolyDP(contour,.65,True).reshape(-1,2)
                if len(points)<3:continue
                path='M'+'L'.join(f'{x} {y}' for x,y in points)+'Z'
            if len(current)+len(path)>28000:
                if current:chunks.append(current)
                current=''
            current+=path
        if current:chunks.append(current)
        fill='#%02x%02x%02x'%tuple(palette[color]);paths.extend({'fill':fill,'d':d} for d in chunks)
    return paths


def animated_svg(frames,fps,title):
    height,width=frames[0][0].shape[:2];palette=palette_for(frames,32);count=len(frames);duration=count/fps
    times=';'.join(f'{i/count:.6f}' for i in range(count+1));groups=[];path_count=0
    for index,(image,mask) in enumerate(frames):
        paths=trace_frame(image,mask,palette);path_count+=len(paths)
        values=';'.join('visible' if i%count==index else 'hidden' for i in range(count+1))
        animation=f'<animate attributeName="visibility" calcMode="discrete" values="{values}" keyTimes="{times}" dur="{duration:.6f}s" repeatCount="indefinite"/>'
        shapes=''.join(f'<path d="{p["d"]}" fill="{p["fill"]}" fill-rule="evenodd"/>' for p in paths)
        fallback='visible' if index==0 else 'hidden'
        groups.append(f'<g id="frame-{index:03d}" visibility="{fallback}">{animation}{shapes}</g>')
    desc=f'{count} vector frames at {fps} fps; independent traced poses, not a rigged model.'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}"><title>{html.escape(title)}</title><desc>{html.escape(desc)}</desc>{"".join(groups)}</svg>',path_count


def main():
    ap=argparse.ArgumentParser(description='从视频片段生成逐帧矢量 SVG 动作参考。')
    ap.add_argument('source',type=Path);ap.add_argument('--model',type=Path,required=True);ap.add_argument('--start',type=float,required=True);ap.add_argument('--end',type=float,required=True)
    ap.add_argument('--fps',type=int,default=20,choices=range(4,31));ap.add_argument('--target',choices=['left','right','largest'],default='largest')
    ap.add_argument('--crop',help='选定人物范围：左,上,右,下（各为 0–1）');ap.add_argument('--size',type=int,default=512,choices=range(128,769));ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    if not args.source.is_file() or not args.model.is_file():ap.error('视频或姿态模型不存在')
    if not math.isfinite(args.start) or not math.isfinite(args.end) or args.start<0 or args.end<=args.start or args.end-args.start>3:ap.error('请提供不超过 3 秒的有效片段')
    if args.out.suffix.lower()!='.svg' or args.out.resolve() in {args.source.resolve(),args.model.resolve()}:ap.error('输出必须是独立的 .svg 文件')
    crop=None
    if args.crop:
        try:crop=tuple(map(float,args.crop.split(',')))
        except ValueError:ap.error('--crop 需要四个 0–1 数值')
        if len(crop)!=4 or not all(0<=v<=1 for v in crop) or crop[2]-crop[0]<.1 or crop[3]-crop[1]<.1:ap.error('--crop 需要有效的左、上、右、下边界')
    try:
        frames=capture(args.source,args.model,args.start,args.end,args.fps,args.target,crop,args.size)
        svg,paths=animated_svg(frames,args.fps,f'{args.source.name} {args.start:g}–{args.end:g}s')
        args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(svg,encoding='utf-8')
        print(f'逐帧 SVG：{args.out}；{len(frames)} 帧 / {args.fps} FPS / {paths} 条矢量路径。')
        print('这是逐帧动作参考，不是可自由摆姿的骨骼模型；请检查人物、遮挡、边缘及帧间稳定性。')
    except (OSError,ValueError,subprocess.CalledProcessError) as e:
        print('生成失败：'+str(e),file=sys.stderr);return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
