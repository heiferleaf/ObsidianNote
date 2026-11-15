import fs from 'node:fs/promises'
import path from 'node:path'
import {vaultRoot as root,readJSON,writeJSON,sha256} from './registry.mjs'
const load=name=>readJSON(path.join(root,'.knowledge',name))
const [state,manifest,threads,inventory,tree,site]=await Promise.all([load('state.json'),load('manifest.json'),load('threads.json'),load('inventory.json'),load('tree-verification.json'),readJSON(path.join(root,'quartz/.quartz-cache/site-build.json'))])
const notes=Object.values(manifest.pages).filter(x=>x.kind==='note')
if(notes.length!==inventory.notes.length||notes.some(x=>x.migration_status!=='verified'||!x.baseline))throw Error('Migration baselines are not complete')
for(const note of inventory.notes)if(sha256(await fs.readFile(path.join(root,note.path)))!==note.sha256)throw Error('Source changed: '+note.path)
const gaps=await load('converted-v3-gaps.json')
const report={
 version:1,status:'completed',completed_at:new Date().toISOString(),
 scope:{source:'002-学习笔记',notes:notes.length,folders:Object.values(manifest.pages).filter(x=>x.kind==='folder').length,total_pages_including_space_root:tree.actual_pages},
 entry:{space_id:state.space.id,page_id:state.space.root_page_id,url:'https://chatgpt.com/space/'+state.space.root_page_id,inbox:state.pages['@inbox'].url,guide:state.pages['@guide'].url,tasks:state.pages['@tasks'].url},
 verification:{verified_notes:notes.length,source_note_bytes_unchanged:true,parent_mismatches:tree.parent_mismatches.length,missing_pages:tree.missing.length,extra_pages:tree.extra.length,comparison_methods:notes.reduce((o,n)=>(o[n.verification_comparison]=(o[n.verification_comparison]??0)+1,o),{}),reviewed_format_pages:notes.filter(n=>n.verification_format_review).map(n=>n.path),page_client_visual_inspection:'Not performed for every Page; complete API readback, content/source checks and KaTeX compilation performed. Website browser checks are recorded separately in quartz-result.json.'},
 display:{ordinary_prose:'native',inline_code:'native',mathematical_paragraphs:'guarded HTML math_region embeds with editable Markdown sources',active_math_regions:Object.keys(manifest.visualizations).length,headings:'native outline; Unicode or adjacent formula for mathematical headings',links:'real Page links and explicit backlinks; unverified block anchors were not invented'},
 assets:{native_references:Object.keys(manifest.attachments).length,quartz_source_keys:Object.keys(await load('quartz-assets.json')).length,generated_media_backup_files:(await fs.readdir(path.join(root,'003-Attachments/pages-import'))).length,missing_original_images:gaps,excalidraw:'static render; original drawing files retained',pdf_selection_fallback:'Four selection-only excerpts use full-page images; rectangle excerpts are cropped'},
 chats:Object.values(threads.threads).map(t=>({role:t.role,title:t.title,threadId:t.threadId,hostId:t.hostId,url:'codex://threads/'+t.threadId})),
 schedule:{automation_id:'automation',status:'ACTIVE',weekday:'Sunday',hour:20,minute:0,timezone:'Asia/Shanghai',execution:'local heartbeat attached to curator chat; requires machine and app available'},
 website:{url:'https://heiferleaf.github.io/ObsidianNote/',build:'passed',build_completed_at:site.completedAt,indexed_pages:site.indexedPages,checked_navigation_links:site.checkedNavigationLinks,checked_local_images:site.checkedLocalImages,rendered_math_errors:site.renderedMathErrors,committed:false,pushed:false,deployed:false,publication_queue:'.knowledge/publication.json'},
 maintenance:{controller_skill:'.codex/skills/knowledge-controller/SKILL.md',curator_skill:'.codex/skills/knowledge-curator/SKILL.md',manifest:'.knowledge/manifest.json',registry:'.knowledge/threads.json',original_sources:'preserved',missing_image_followup:'Two unchecked tasks on the learning tasks Page cover the three unavailable original images'}
}
await writeJSON(path.join(root,'.knowledge/migration-report.json'),report)
console.log(JSON.stringify({notes:notes.length,pages:tree.actual_pages,math_regions:Object.keys(manifest.visualizations).length,missing_original_images:gaps.length,report:'.knowledge/migration-report.json'}))
