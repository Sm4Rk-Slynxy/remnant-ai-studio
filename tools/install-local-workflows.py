#!/usr/bin/env python3
"""Install separately licensed workflow copies; never download or execute nodes."""
import argparse
import json
from pathlib import Path
import os

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
for name in ('character-api', 'photoshoot-api', 'photoshoot-options', 'krea-editor'):
    parser.add_argument('--'+name, type=Path)
args = parser.parse_args()
files = {'character_api':'micw-all-in-one-character-api.json','photoshoot_api':'photoshoot-series-api.json','photoshoot_options':'photoshoot-options.json','krea_editor':'krea2-pro-grade-source.json'}
pending = []
for key, filename in files.items():
    source = getattr(args, key)
    if source is None: continue
    if source.stat().st_size > 10*1024*1024: parser.error('Workflow exceeds 10 MB.')
    raw = source.read_text(encoding='utf-8')
    value = json.loads(raw)
    if not isinstance(value, dict): parser.error('Expected a JSON object.')
    if key.endswith('_api') and (not value or not all(isinstance(n,dict) and isinstance(n.get('inputs'),dict) and isinstance(n.get('class_type'),str) for n in value.values())):
        parser.error('Use an API-exported workflow, not an editor graph.')
    if key=='character_api' and not all(i in value for i in ('1226','1297','1314','1232:1242')): parser.error('Character graph does not match this wrapper.')
    if key=='photoshoot_api' and not all(i in value for i in ('1','2','3','10','11','20','21','22','40','41','42','51')): parser.error('Photoshoot graph does not match this wrapper.')
    if key=='photoshoot_options' and not all(i in value for i in ('person','shooting')): parser.error('Missing photoshoot option groups.')
    if key=='krea_editor' and not isinstance(value.get('nodes'),list): parser.error('Expected a Krea editor graph.')
    pending.append((filename,raw))
if not pending: parser.error('Choose at least one workflow file.')
target = root/'workflows/local'
target.mkdir(parents=True, exist_ok=True)
for filename,raw in pending:
    path = target/filename
    if path.is_symlink(): parser.error('Refusing to replace a symlink.')
    fd = os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as stream: stream.write(raw)
    print('Installed local integration:',filename)
print('These files remain private/untracked and retain their original terms. Review them for secrets before use.')
