import pathlib, json, re, hashlib, math
from PIL import Image, ImageDraw, ImageFont
from lzstring import LZString
ROOT=pathlib.Path(__file__).resolve().parent.parent
file=ROOT/'.knowledge/materialized.json'
assets=json.loads(file.read_text(encoding='utf-8-sig'))
fontfile='C:/Windows/Fonts/msyh.ttc'
for a in assets:
    if not a.get('excalidraw'):continue
    try:
        text=pathlib.Path(a['drawing_source']).read_text(encoding='utf-8-sig')
        match=re.search(r'```compressed-json\s+([\s\S]*?)```',text)
        if match:data=json.loads(LZString.decompressFromBase64(re.sub(r'\s+','',match.group(1))))
        else:data=json.loads(re.search(r'```json\s+([\s\S]*?)```',text).group(1))
        elements=[e for e in data['elements'] if not e.get('isDeleted')]
        x0=min(e['x'] for e in elements)-24;y0=min(e['y'] for e in elements)-24
        x1=max(e['x']+e.get('width',0) for e in elements)+24;y1=max(e['y']+e.get('height',0) for e in elements)+24
        scale=min(2,8000/max(x1-x0,y1-y0));size=(math.ceil((x1-x0)*scale),math.ceil((y1-y0)*scale))
        image=Image.new('RGB',size,'white');draw=ImageDraw.Draw(image)
        for e in elements:
            x=(e['x']-x0)*scale;y=(e['y']-y0)*scale;w=e.get('width',0)*scale;h=e.get('height',0)*scale
            color=e.get('strokeColor','#1e1e1e');fill=e.get('backgroundColor','transparent');fill=None if fill=='transparent' else fill
            width=max(1,round(e.get('strokeWidth',1)*scale));kind=e['type']
            if kind=='rectangle':draw.rectangle((x,y,x+w,y+h),outline=color,fill=fill,width=width)
            elif kind=='ellipse':draw.ellipse((x,y,x+w,y+h),outline=color,fill=fill,width=width)
            elif kind=='diamond':draw.polygon([(x+w/2,y),(x+w,y+h/2),(x+w/2,y+h),(x,y+h/2)],outline=color,fill=fill)
            elif kind in ['line','arrow','freedraw']:
                points=[(x+p[0]*scale,y+p[1]*scale) for p in e.get('points',[])]
                if len(points)>1:
                    draw.line(points,fill=color,width=width)
                    if kind=='arrow' and e.get('endArrowhead'):
                        end=points[-1];prev=points[-2];angle=math.atan2(end[1]-prev[1],end[0]-prev[0]);length=10*scale
                        draw.line([end,(end[0]-length*math.cos(angle-.45),end[1]-length*math.sin(angle-.45))],fill=color,width=width)
                        draw.line([end,(end[0]-length*math.cos(angle+.45),end[1]-length*math.sin(angle+.45))],fill=color,width=width)
            elif kind=='text':
                font=ImageFont.truetype(fontfile,max(8,round(e.get('fontSize',20)*scale)))
                draw.multiline_text((x,y),e.get('text',e.get('originalText','')),fill=color,font=font,spacing=4*scale)
            elif kind=='image':
                import base64,io
                stored=data.get('files',{}).get(e.get('fileId'),{})
                dataurl=stored.get('dataURL','')
                if dataurl.startswith('data:'):
                    pic=Image.open(io.BytesIO(base64.b64decode(dataurl.split(',',1)[1]))).convert('RGBA').resize((max(1,round(w)),max(1,round(h))))
                    image.paste(pic,(round(x),round(y)),pic)
        dest=ROOT/'.knowledge/media'/(hashlib.sha256(a['key'].encode()).hexdigest()[:20]+'.png')
        image.save(str(dest));a.update(file=str(dest),status='materialized',drawing_render='simplified-vector-export')
    except Exception as error:a.update(status='error',error=str(error))
file.write_text(json.dumps(assets,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'key':a['key'],'status':a['status'],'error':a.get('error')} for a in assets if a.get('excalidraw')],ensure_ascii=False))
