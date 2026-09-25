"""Verify the supplied package and import display-only shards without personal fixtures."""
import sys,json,hashlib,pathlib
src=pathlib.Path(sys.argv[1]); dest=pathlib.Path(__file__).resolve().parents[1]/'backend/src/lib/report/annual3600/data'
manifest=json.loads((src/'PACKAGE_MANIFEST.json').read_text())
for f in manifest['files']:
    b=(src/f['path']).read_bytes()
    assert len(b)==f['size_bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'], f['path']
canonical=json.loads((src/'approved_content/readings_3600.json').read_text())['records']
assert len(canonical)==3600
byid={r['pattern_id']:r for r in canonical}; assert len(byid)==3600
fields=['pattern_id','day_index','year_cycle_index','title','description','relationship','career','life','source_pattern_id']
editorial_path=pathlib.Path(__file__).with_name('annual3600Editorial.json')
editorial=json.loads(editorial_path.read_text())
counts=[0]*len(editorial['replacements'])
dest.mkdir(parents=True,exist_ok=True)
for d in range(60):
    shard=json.loads((src/f'integration/readings_by_day/{d+1:02}.json').read_text())
    assert len(shard['records'])==60
    for y,r in enumerate(shard['records']):
        assert r['pattern_id']==f'P{d+1:02}-Y{y+1:02}' and r['day_index']==d and r['year_cycle_index']==y
        assert all(r[k]==byid[r['pattern_id']][k] for k in fields)
    records=[{k:r[k] for k in fields} for r in shard['records']]
    for record in records:
        for i,edit in enumerate(editorial['replacements']):
            field=edit['field']
            assert field in ['description','relationship','career','life']
            counts[i]+=record[field].count(edit['before'])
            record[field]=record[field].replace(edit['before'],edit['after'])
    (dest/f'{d+1:02}.json').write_text(json.dumps({'records':records},ensure_ascii=False,separators=(',',':'))+'\n')
assert counts==[e['count'] for e in editorial['replacements']], counts
hash=hashlib.sha256((src/'approved_content/readings_3600.json').read_bytes()).hexdigest()
wording_hash=hashlib.sha256(editorial_path.read_bytes()).hexdigest()
(dest.parent/'version.ts').write_text(f"export const ANNUAL3600_VERSION = 'annual3600-v1-{hash[:12]}-rules1-{editorial['revision']}-{wording_hash[:12]}'\n")
print(json.dumps({'verified_files':len(manifest['files']),'records':len(canonical),'canonical_sha256':hash,'editorial_sha256':wording_hash,'replacements':counts}))
