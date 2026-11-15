import copy
import json
from pathlib import Path
import tempfile
import unittest
import catalog

class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='knowledge-catalog-')
        self.root = Path(self.temp.name)
        (self.root / '.knowledge').mkdir()
        (self.root / '002-学习笔记').mkdir()
        self.note = self.root / '002-学习笔记/thread.md'
        self.note.write_text('虚拟线程与协程\n\n100% coverage and a_b.\n', encoding='utf8')
        self.manifest = {'version': 1, 'pages': {'page-one': {'page_id': 'page-one', 'kind': 'note', 'title': '线程', 'path': '002-学习笔记/thread.md', 'url': 'https://example.invalid/note', 'origin': 'imported', 'aliases': ['虚拟线程'], 'maintainer_expert': 'stale-manifest-owner', 'source_frontmatter': {'subject': 'Java', 'tags': ['并发']}, 'baseline': {'synced_at': '2026-11-14T00:00:00Z'}}}}
        self.registry = {'version': 1, 'threads': {'expert-a': {'threadId': 'expert-a', 'title': 'Expert Java', 'role': 'expert'}, 'expert-b': {'threadId': 'expert-b', 'title': 'Expert Runtime', 'role': 'expert'}, 'controller': {'threadId': 'controller', 'title': 'Controller', 'role': 'controller'}}, 'pages': {'page-one': {'page_id': 'page-one', 'origin': 'imported', 'source_thread': None, 'maintainer_expert': None}}}
        self.save()

    def tearDown(self):
        self.temp.cleanup()

    def save(self):
        for name, value in [('manifest.json', self.manifest), ('threads.json', self.registry)]:
            (self.root / '.knowledge' / name).write_text(json.dumps(value, ensure_ascii=False), encoding='utf8')

    def test_persistent_search_and_no_invented_owner(self):
        before = (self.root / '.knowledge/threads.json').read_bytes()
        row = catalog.query(self.root, '虚拟 协程')[0]
        self.assertIsNone(row['maintainer_expert'])
        self.assertEqual(row['association_status'], 'unassigned')
        self.assertEqual(catalog.query(self.root, '100%')[0]['page_id'], 'page-one')
        self.assertEqual(catalog.query(self.root, "' OR 1=1 --"), [])
        self.assertEqual(before, (self.root / '.knowledge/threads.json').read_bytes())

    def test_binding_and_lifecycle_refresh_without_memory(self):
        catalog.query(self.root)
        self.registry['pages']['page-one']['maintainer_expert'] = 'expert-a'
        self.save()
        row = catalog.query(self.root, page_id='page-one')[0]
        self.assertEqual(row['maintainer_expert_title'], 'Expert Java')
        self.assertEqual(row['links'][0]['relationship'], 'maintainer')
        self.registry['threads']['expert-a']['lifecycle'] = 'archived'
        self.save()
        self.assertEqual(catalog.query(self.root)[0]['association_status'], 'needs_review')
        self.registry['pages']['page-one']['maintainer_expert'] = 'expert-b'
        self.save()
        self.assertEqual(catalog.query(self.root)[0]['maintainer_expert_title'], 'Expert Runtime')

    def test_history_and_metadata_are_readable(self):
        binding = self.registry['pages']['page-one']
        binding.update(maintainer_expert='expert-a', keywords=['调度器'], note_type='通用知识', association_history=[{'at': '2026-11-14', 'before': {}, 'after': {'maintainer_expert': 'expert-a'}}])
        self.save()
        self.assertEqual(catalog.query(self.root, '调度器')[0]['note_type'], '通用知识')
        self.assertEqual(len(catalog.query(self.root, page_id='page-one')[0]['history']), 1)
        self.assertEqual(catalog.export(self.root)['notes'], 1)
        self.assertIn('Expert Java', (self.root / '.knowledge/requests/note-expert-index.md').read_text(encoding='utf8'))

    def test_invalid_provenance_and_wrong_role_block(self):
        original = copy.deepcopy(self.registry)
        self.registry['pages']['page-one']['source_thread'] = 'expert-a'
        self.save()
        with self.assertRaisesRegex(ValueError, 'Imported note'):
            catalog.query(self.root)
        self.registry = original
        self.registry['pages']['page-one']['maintainer_expert'] = 'controller'
        self.save()
        with self.assertRaisesRegex(ValueError, 'registered Worker'):
            catalog.query(self.root)

    def test_canonical_worker_roles_keep_compatibility_fields(self):
        self.registry['threads']['expert-a'].update(role='worker', title='Worker Java')
        self.registry['threads']['expert-b']['role'] = 'worker'
        self.registry['threads']['controller']['role'] = 'router'
        self.registry['pages']['page-one']['maintainer_expert'] = 'expert-a'
        self.save()
        self.assertEqual(catalog.query(self.root)[0]['maintainer_expert_title'], 'Worker Java')

    def test_local_changes_refresh_search_and_escape_is_rejected(self):
        catalog.query(self.root)
        self.note.write_text('新的专属检索词', encoding='utf8')
        self.assertEqual(catalog.query(self.root, '专属')[0]['page_id'], 'page-one')
        self.manifest['pages']['page-one']['path'] = '../outside.md'
        self.save()
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            catalog.query(self.root)

    def test_new_notes_only_excludes_legacy_even_if_renamed_or_enrolled(self):
        policy = {'version': 1, 'scope': 'new-notes-only', 'excluded_existing_page_ids': ['page-one']}
        (self.root / '.knowledge/catalog-policy.json').write_text(json.dumps(policy), encoding='utf8')
        self.registry['pages']['page-one']['catalog_managed'] = True
        self.manifest['pages']['page-one']['title'] = 'Renamed legacy note'
        self.save()
        self.assertEqual(catalog.query(self.root), [])
        self.assertEqual(catalog.export(self.root)['notes'], 0)
        self.assertIn('maintainer_expert', (self.root / '.knowledge/note-expert-index.csv').read_text(encoding='utf-8-sig'))
        second = copy.deepcopy(self.manifest['pages']['page-one'])
        second.update(page_id='page-new', title='New note', path='002-学习笔记/new.md')
        self.manifest['pages']['page-new'] = second
        (self.root / second['path']).write_text('Future learning content', encoding='utf8')
        self.registry['pages']['page-new'] = {'page_id': 'page-new', 'origin': 'template', 'catalog_managed': True, 'source_thread': None, 'maintainer_expert': 'expert-a'}
        self.save()
        self.assertEqual([x['page_id'] for x in catalog.query(self.root)], ['page-new'])

if __name__ == '__main__':
    unittest.main()
