"""Recover the two PDF++ clips missed because a filename contains square brackets."""
import hashlib
import json
from pathlib import Path
import fitz

root = Path(__file__).resolve().parent.parent
book = '009-电子书籍/[沙特]M. H. Alsuwaiyel - 算法设计技巧与分析-电子工业出版社 (2004).pdf'
rows = []
with fitz.open(root / book) as doc:
    for page_no, coords in [(64, [189, 1487, 1395, 2064]), (67, [161, 1445, 1495, 1942])]:
        fragment = 'page=' + str(page_no) + '&rect=' + ','.join(map(str, coords))
        key = book + '#' + fragment
        page = doc[page_no - 1]
        clip = (fitz.Rect(coords) * page.transformation_matrix) & page.rect
        if clip.is_empty:
            raise ValueError('Empty PDF clip: ' + key)
        dest = root / '.knowledge/media' / (hashlib.sha256(key.encode()).hexdigest()[:20] + '.png')
        dest.parent.mkdir(parents=True, exist_ok=True)
        page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip, alpha=False).save(str(dest))
        data = dest.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        backup = root / '003-Attachments/pages-import' / (sha[:24] + '.png')
        backup.parent.mkdir(parents=True, exist_ok=True)
        if backup.exists() and backup.read_bytes() != data:
            raise ValueError('Backup content mismatch')
        backup.write_bytes(data)
        rows.append({'key': key, 'path': backup.relative_to(root).as_posix(), 'file': str(backup), 'sha256': sha, 'byte_size': len(data), 'mime_type': 'image/png', 'page': page_no})
vc = '002-学习笔记/课程学习/计算机网络/图片/第一章/VC入口出口表.png'
data = (root / vc).read_bytes()
rows.append({'key': vc, 'path': vc, 'file': str(root / vc), 'sha256': hashlib.sha256(data).hexdigest(), 'byte_size': len(data), 'mime_type': 'image/png'})
(root / '.knowledge/repair-assets.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(rows, ensure_ascii=False))
