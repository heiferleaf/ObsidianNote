"""Materialize only the attachments actually referenced by learning notes."""
import json, pathlib, hashlib, re, urllib.request, time, shutil
import fitz
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAN = ROOT / '.knowledge' / 'plan.json'
OUT = ROOT / '.knowledge' / 'media'
OUT.mkdir(parents=True, exist_ok=True)
plan = json.loads(PLAN.read_text(encoding='utf-8-sig'))
results = []
for asset in plan['assets']:
    item = dict(asset)
    key = asset['key']
    token = hashlib.sha256(key.encode()).hexdigest()[:20]
    try:
        if asset.get('url'):
            dest = OUT / (token + '.png')
            if not dest.exists():
                req = urllib.request.Request(asset['url'], headers={'User-Agent':'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=25) as response:
                    data=response.read(10*1024*1024+1)
                if len(data)>10*1024*1024: raise ValueError('remote image exceeds 10 MiB')
                raw=OUT/(token+'.source'); raw.write_bytes(data)
                with Image.open(str(raw)) as image:
                    image.seek(0)
                    if image.format == 'GIF':
                        dest = OUT / (token + '.gif')
                        shutil.copyfile(raw, dest)
                    else:
                        image.convert('RGB').save(str(dest),'PNG')
            gif = OUT / (token + '.gif')
            if gif.exists(): dest = gif
            item['file']=str(dest)
        elif asset.get('pdf') and asset.get('fragment'):
            page_match=re.search(r'(?:^|&)page=(\d+)',asset['fragment'])
            if not page_match: raise ValueError('PDF fragment has no page number')
            page_no=int(page_match.group(1))
            dest=OUT/(token+'.png')
            if not dest.exists():
                doc=fitz.open(str(ROOT/asset['path']))
                page=doc[page_no-1]
                rect_match=re.search(r'(?:^|&)rect=([\d.,-]+)',asset['fragment'])
                clip=None
                if rect_match:
                    coords=[float(x) for x in rect_match.group(1).split(',')]
                    if len(coords)==4:
                        # Obsidian PDF++ rectangles use PDF coordinates, with origin at bottom left.
                        clip=(fitz.Rect(coords) * page.transformation_matrix) & page.rect
                        if clip.is_empty: raise ValueError('empty PDF clip')
                page.get_pixmap(matrix=fitz.Matrix(2,2),clip=clip,alpha=False).save(str(dest))
            item.update(file=str(dest),page=page_no)
        elif asset.get('excalidraw'):
            item['drawing_source']=str(ROOT/asset['path'])
            item['file']=None
        else:
            file=ROOT/asset['path']
            if file.stat().st_size>10*1024*1024: raise ValueError('file exceeds Pages 10 MiB upload limit')
            item['file']=str(file)
        item['status']='materialized' if item.get('file') else 'drawing_pending'
    except Exception as error:
        item.update(status='error',error=str(error),file=None)
    results.append(item)
    (ROOT/'.knowledge/materialized.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'total':len(results),'ready':sum(r['status']=='materialized' for r in results),'drawings':sum(r['status']=='drawing_pending' for r in results),'errors':[{'key':r['key'],'error':r.get('error')} for r in results if r['status']=='error']},ensure_ascii=False,indent=2))
