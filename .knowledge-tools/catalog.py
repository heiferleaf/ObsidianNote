"""A rebuildable SQLite index over the persistent manifest and Expert registry.

Facts are changed with registry.mjs; queries automatically refresh stale projections.
No Page/chat API calls, source-note writes, or guessed Expert assignments.
"""
import argparse
import contextlib
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
VERSION = '3'

def include_note(page_id, row, registry, policy):
    if row.get('kind') != 'note':
        return False
    if policy.get('scope') == 'new-notes-only':
        return page_id not in policy['excluded_existing_page_ids'] and registry['pages'].get(page_id, {}).get('catalog_managed') is True
    return True

def sha(data):
    return hashlib.sha256(data).hexdigest()

def safe(root, relative):
    if not isinstance(relative, str) or '\\' in relative or Path(relative).is_absolute() or '..' in Path(relative).parts:
        raise ValueError('Unsafe note path: ' + str(relative))
    target = (root / relative).resolve()
    target.relative_to(root.resolve())
    if not relative.startswith('002-学习笔记/') or not relative.endswith('.md'):
        raise ValueError('Not a managed learning note: ' + relative)
    return target

def load_inputs(root):
    parts = []
    for name in ['manifest.json', 'threads.json']:
        raw = (root / '.knowledge' / name).read_bytes()
        parts.append(raw)
    manifest, registry = [json.loads(x.decode('utf-8-sig')) for x in parts]
    if manifest.get('version') != 1 or registry.get('version') != 1:
        raise ValueError('Unsupported manifest/registry schema')
    policy_file = root / '.knowledge/catalog-policy.json'
    policy_raw = policy_file.read_bytes() if policy_file.exists() else b'{}'
    policy = json.loads(policy_raw.decode('utf-8-sig'))
    if policy and (policy.get('version') != 1 or policy.get('scope') != 'new-notes-only' or not isinstance(policy.get('excluded_existing_page_ids'), list)):
        raise ValueError('Unsupported catalog policy')
    parts.append(policy_raw)
    bodies = {}
    for key, row in sorted(manifest['pages'].items()):
        if not include_note(key, row, registry, policy):
            continue
        if row.get('page_id') != key:
            raise ValueError('Manifest identity mismatch')
        filename = safe(root, row['path'])
        raw = filename.read_bytes() if filename.exists() else None
        parts.extend([key.encode(), b'MISSING' if raw is None else raw])
        bodies[key] = None if raw is None else raw.decode('utf-8-sig')
    digest = sha(b''.join(len(x).to_bytes(8, 'big') + x for x in parts))
    return manifest, registry, bodies, digest

def strings(*values):
    result = []
    for value in values:
        for item in ([value] if isinstance(value, str) else value if isinstance(value, list) else []):
            if isinstance(item, str) and item.strip() and item not in result:
                result.append(item)
    return result

def excerpt(body):
    text = re.sub(r'\A---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)', '', body or '')
    text = re.sub(r'(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1', '', text)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'!\[\[[^\n]*?\]\]|!\[[^\n]*?\]\([^\n]*?\)', '', text)
    return re.sub(r'\s+', ' ', re.sub(r'[#>*_`]', '', text)).strip()[:180]

@contextlib.contextmanager
def build_lock(root):
    lock = root / '.knowledge/catalog.sqlite.lock'
    start = time.monotonic()
    while True:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            break
        except FileExistsError:
            if time.monotonic() - start > 5:
                raise RuntimeError('Catalog lock busy; inspect owner before removing it')
            time.sleep(.05)
    try:
        yield
    finally:
        lock.unlink()

SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE threads (thread_id TEXT PRIMARY KEY, title TEXT NOT NULL,
 role TEXT NOT NULL, aliases_json TEXT NOT NULL, topics_json TEXT NOT NULL,
 lifecycle TEXT NOT NULL, lifecycle_checked_at TEXT);
CREATE TABLE notes (page_id TEXT PRIMARY KEY, title TEXT NOT NULL, aliases_json TEXT NOT NULL,
 keywords_json TEXT NOT NULL, tags_json TEXT NOT NULL, subject TEXT, note_type TEXT,
 local_path TEXT NOT NULL UNIQUE, parent_page_id TEXT, page_url TEXT NOT NULL, origin TEXT,
 source_thread TEXT REFERENCES threads(thread_id), maintainer_expert TEXT REFERENCES threads(thread_id),
 summary TEXT NOT NULL, association_status TEXT NOT NULL, review_status TEXT NOT NULL,
 last_content_sync_at TEXT, last_association_check_at TEXT, association_updated_at TEXT,
 local_file_status TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE note_expert_links (page_id TEXT REFERENCES notes(page_id),
 thread_id TEXT REFERENCES threads(thread_id), relationship TEXT NOT NULL,
 PRIMARY KEY(page_id,thread_id,relationship));
CREATE TABLE association_history (page_id TEXT REFERENCES notes(page_id), ordinal INTEGER,
 event_json TEXT NOT NULL, PRIMARY KEY(page_id,ordinal));
CREATE INDEX notes_subject ON notes(subject);
CREATE INDEX notes_maintainer ON notes(maintainer_expert);
CREATE INDEX links_expert ON note_expert_links(thread_id);
CREATE VIEW note_expert_index AS SELECT n.page_id,n.title,n.aliases_json,n.keywords_json,n.tags_json,
 n.subject,n.note_type,n.local_path,n.parent_page_id,n.page_url,n.origin,n.source_thread,
 s.title AS source_expert_title,n.maintainer_expert,e.title AS maintainer_expert_title,
 e.lifecycle AS maintainer_lifecycle,n.summary,
 n.association_status,n.review_status,n.last_content_sync_at,n.last_association_check_at,
 n.association_updated_at,n.local_file_status FROM notes n
 LEFT JOIN threads s ON s.thread_id=n.source_thread
 LEFT JOIN threads e ON e.thread_id=n.maintainer_expert;
'''

def rebuild(root, force=False):
    directory = root / '.knowledge'
    directory.mkdir(parents=True, exist_ok=True)
    filename = directory / 'catalog.sqlite'
    with build_lock(root):
        for attempt in range(3):
            manifest, registry, bodies, digest = load_inputs(root)
            if filename.exists() and not force:
                with contextlib.closing(sqlite3.connect(filename)) as old:
                    meta = dict(old.execute('SELECT key,value FROM meta'))
                if meta.get('sources_sha256') == digest and meta.get('schema_version') == VERSION:
                    return filename
            temporary = directory / ('catalog-' + uuid.uuid4().hex + '.sqlite.tmp')
            conn = sqlite3.connect(temporary)
            try:
                conn.executescript(SCHEMA)
                for key, thread in registry['threads'].items():
                    if key != thread['threadId']:
                        raise ValueError('Thread identity mismatch')
                    conn.execute('INSERT INTO threads VALUES (?,?,?,?,?,?,?)', (key, thread['title'], thread['role'], json.dumps(thread.get('aliases', []), ensure_ascii=False), json.dumps(thread.get('topics', []), ensure_ascii=False), thread.get('lifecycle', 'unknown'), thread.get('lifecycle_checked_at')))
                for key, row in manifest['pages'].items():
                    if key not in bodies:
                        continue
                    binding = registry['pages'].get(key, {})
                    source, owner = binding.get('source_thread'), binding.get('maintainer_expert')
                    origin = binding.get('origin', row.get('origin'))
                    if origin == 'imported' and source is not None:
                        raise ValueError('Imported note cannot claim a learning source: ' + key)
                    links = [(source, 'source'), (owner, 'maintainer')] + [(x, 'contributor') for x in binding.get('contributor_experts', [])]
                    for thread_id, relationship in links:
                        if thread_id and registry['threads'].get(thread_id, {}).get('role') not in ('worker', 'expert'):
                            raise ValueError('Association is not a registered Worker: ' + str(thread_id))
                    verification = binding.get('verification', {})
                    checked = verification.get('checked_at') if verification.get('maintainer_expert') == owner else None
                    review = binding.get('review_status', 'unverified')
                    if verification.get('status') == 'needs_review':
                        review = 'needs_review'
                    lifecycle = registry['threads'].get(owner, {}).get('lifecycle')
                    status = 'unassigned' if not owner else 'needs_review' if review == 'needs_review' or lifecycle in ['missing', 'archived'] else 'assigned'
                    data = row.get('source_frontmatter', {})
                    aliases = strings(row.get('aliases'), binding.get('aliases'), data.get('aliases'), data.get('alias'))
                    keywords = strings(binding.get('keywords'))
                    tags = strings(data.get('tags'), data.get('tag'))
                    body = bodies[key]
                    values = (key, row['title'], json.dumps(aliases, ensure_ascii=False), json.dumps(keywords, ensure_ascii=False), json.dumps(tags, ensure_ascii=False), data.get('subject') if isinstance(data.get('subject'), str) else None, binding.get('note_type'), row['path'], row.get('parent_page_id'), row['url'], origin, source, owner, binding.get('summary') or excerpt(body), status, review, row.get('baseline', {}).get('synced_at'), checked, binding.get('updated_at'), 'missing' if body is None else 'present', body or '')
                    conn.execute('INSERT INTO notes VALUES (' + ','.join('?' for _ in values) + ')', values)
                    for thread_id, relationship in links:
                        if thread_id:
                            conn.execute('INSERT OR IGNORE INTO note_expert_links VALUES (?,?,?)', (key, thread_id, relationship))
                    for ordinal, event in enumerate(binding.get('association_history', [])):
                        conn.execute('INSERT INTO association_history VALUES (?,?,?)', (key, ordinal, json.dumps(event, ensure_ascii=False)))
                conn.executemany('INSERT INTO meta VALUES (?,?)', [('schema_version', VERSION), ('sources_sha256', digest), ('built_at', time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))])
                conn.commit()
                if conn.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('Catalog foreign key check failed')
                conn.close()
                if load_inputs(root)[3] != digest:
                    temporary.unlink()
                    continue
                os.replace(temporary, filename)
                return filename
            finally:
                conn.close()
                temporary.unlink(missing_ok=True)
        raise RuntimeError('Registry or sources changed repeatedly; retry with fresh inputs')

def query(root, terms='', page_id=None, expert=None, status=None, limit=20):
    filename = rebuild(root)
    with contextlib.closing(sqlite3.connect(filename)) as conn:
        conn.row_factory = sqlite3.Row
        sql = 'SELECT i.* FROM note_expert_index i JOIN notes n USING(page_id) WHERE 1=1'
        params, scores, score_params = [], [], []
        if page_id:
            sql += ' AND i.page_id=?'
            params.append(page_id)
        for term in terms.split():
            sql += " AND (n.title||' '||n.aliases_json||' '||n.keywords_json||' '||n.tags_json||' '||coalesce(n.subject,'')||' '||n.summary||' '||n.body) LIKE ? ESCAPE '\\'"
            params.append('%' + term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%')
            scores.append("CASE WHEN n.title LIKE ? ESCAPE '\\' THEN 30 ELSE 0 END + CASE WHEN n.aliases_json LIKE ? ESCAPE '\\' THEN 15 ELSE 0 END")
            score_params.extend([params[-1], params[-1]])
        if expert:
            sql += ' AND EXISTS (SELECT 1 FROM note_expert_links l WHERE l.page_id=i.page_id AND l.thread_id=?)'
            params.append(expert)
        if status:
            sql += ' AND i.association_status=?'
            params.append(status)
        sql += ' ORDER BY ' + ('(' + '+'.join(scores) + ') DESC,' if scores else '') + 'i.title,i.page_id LIMIT ?'
        rows = [dict(x) for x in conn.execute(sql, params + score_params + [limit])]
        if page_id and rows:
            rows[0]['links'] = [dict(x) for x in conn.execute('SELECT * FROM note_expert_links WHERE page_id=?', [page_id])]
            rows[0]['history'] = [json.loads(x[0]) for x in conn.execute('SELECT event_json FROM association_history WHERE page_id=? ORDER BY ordinal', [page_id])]
        return rows

def export(root):
    rows = query(root, limit=100000)
    directory = root / '.knowledge'
    with contextlib.closing(sqlite3.connect(directory / 'catalog.sqlite')) as conn:
        fields = [column[1] for column in conn.execute('PRAGMA table_info(note_expert_index)') if column[1] != 'summary']
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fields, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)
    def atomic(filename, data):
        temporary = filename.with_name(filename.name + '.' + uuid.uuid4().hex + '.tmp')
        try:
            temporary.write_bytes(data)
            os.replace(temporary, filename)
        finally:
            temporary.unlink(missing_ok=True)
    atomic(directory / 'note-expert-index.csv', output.getvalue().encode('utf-8-sig'))
    label = lambda text: str(text or '').replace('\\', '\\\\').replace('|', '\\|').replace('[', '\\[').replace(']', '\\]').replace('\n', ' ')
    def expert_link(row, role):
        key = row.get('maintainer_expert' if role == 'maintainer' else 'source_thread')
        title = row.get('maintainer_expert_title' if role == 'maintainer' else 'source_expert_title')
        return '[' + label(title) + '](codex://threads/' + key + ')' if key else '待关联' if role == 'maintainer' else '历史迁入' if row['origin'] == 'imported' else '暂无'
    lines = ['本表仅维护之后新建的学习笔记与 Worker 关联。新建时登记，Worker 每周归纳核验目录、聊天状态并刷新本表。', '', '已有笔记不补录，后续编辑、更名或移动也不会自动加入本表。已有笔记仍可通过 Pages 和本地正文查找。', '', '# 新建笔记索引', '', '| 笔记 | 主题 | 类型 | 维护 Worker | 学习来源 | 关联状态 | 最近关联核验 |', '| --- | --- | --- | --- | --- | --- | --- |']
    statuses = {'unassigned': '待关联', 'assigned': '已关联', 'needs_review': '需复核'}
    for row in rows:
        topic = row['subject'] or '/'.join(Path(row['local_path']).parts[1:-1])
        lines.append('| [' + label(row['title']) + '](' + row['page_url'] + ') | ' + label(topic) + ' | ' + label(row['note_type'] or '未标注') + ' | ' + expert_link(row, 'maintainer') + ' | ' + expert_link(row, 'source') + ' | ' + statuses[row['association_status']] + ' | ' + label(row['last_association_check_at'] or '尚未核验') + ' |')
    if not rows:
        lines.extend(['', '当前暂无新建笔记索引项。'])
    requests = directory / 'requests'
    requests.mkdir(exist_ok=True)
    markdown = '\n'.join(lines) + '\n'
    atomic(requests / 'note-expert-index.md', markdown.encode('utf8'))
    with contextlib.closing(sqlite3.connect(directory / 'catalog.sqlite')) as conn:
        meta = dict(conn.execute('SELECT key,value FROM meta'))
    atomic(requests / 'note-expert-index.json', json.dumps({'sources_sha256': meta['sources_sha256'], 'markdown_sha256': sha(markdown.encode('utf8')), 'notes': len(rows)}, indent=2).encode('utf8'))
    return {'notes': len(rows), 'csv': '.knowledge/note-expert-index.csv', 'page_markdown': '.knowledge/requests/note-expert-index.md'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['rebuild', 'search', 'show', 'check', 'export'])
    parser.add_argument('value', nargs='?', default='')
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--expert', help='Exact registered thread ID')
    parser.add_argument('--status', choices=['unassigned', 'assigned', 'needs_review'])
    parser.add_argument('--limit', type=int, default=20)
    args = parser.parse_args()
    root = args.root.resolve()
    if not 1 <= args.limit <= 100:
        parser.error('--limit must be between 1 and 100')
    if args.command == 'rebuild':
        result = {'database': str(rebuild(root, force=True))}
    elif args.command == 'export':
        result = export(root)
    elif args.command == 'check':
        with contextlib.closing(sqlite3.connect(rebuild(root))) as conn:
            result = {'notes': conn.execute('SELECT count(*) FROM notes').fetchone()[0], 'threads': conn.execute('SELECT count(*) FROM threads').fetchone()[0], 'states': dict(conn.execute('SELECT association_status,count(*) FROM notes GROUP BY association_status')), 'missing_local': conn.execute("SELECT count(*) FROM notes WHERE local_file_status='missing'").fetchone()[0], 'foreign_key_issues': conn.execute('PRAGMA foreign_key_check').fetchall(), 'sources_sha256': dict(conn.execute('SELECT key,value FROM meta'))['sources_sha256']}
    else:
        result = query(root, args.value if args.command == 'search' else '', args.value if args.command == 'show' else None, args.expert, args.status, args.limit)
    print(json.dumps(result, ensure_ascii=True, indent=2))

if __name__ == '__main__':
    main()
