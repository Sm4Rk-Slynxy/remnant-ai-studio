#!/usr/bin/env python3
"""Check public tracked files without printing candidate secret values.

Heuristic guardrail, not a complete secret detector. Review screenshots manually and
use GitHub secret scanning/push protection as well. No network access is performed.
"""
from pathlib import Path
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEXED = False
IGNORED = {'.git', 'node_modules', '__pycache__', '.venv', 'test-results', 'playwright-report'}
FORBIDDEN = {'artifacts', 'private', 'uploads', 'outputs', 'backups'}
BLOCKED_NAMES = {'shared-productions.json', 'COMFY-MODEL-CATALOG.md', 'settings.json'}
MEDIA = {'.mp3', '.mp4', '.wav', '.flac', '.safetensors', '.gguf', '.pth', '.pt', '.ckpt', '.zip'}
PATTERNS = {
    'personal LAN address': re.compile(r'192[.]168[.]68[.]\d+'),
    'personal filesystem path': re.compile(r'/(?:home|run/media|media)/lab(?:/|\b)'),
    'GitHub token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,})\b'),
    'provider API key': re.compile(r'\b(?:sk-[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16})\b'),
    'private key block': re.compile('-{5}BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-{5}'),
}

def candidates():
    global INDEXED
    proc = subprocess.run(['git', 'ls-files', '-z', '--cached'], cwd=ROOT, capture_output=True)
    if proc.returncode == 0:
        INDEXED = True
        result = [ROOT/p for p in proc.stdout.decode().split('\0') if p]
        if not result: raise ValueError('Git index is empty; stage the intended public files before scanning.')
        return result
    return [p for p in ROOT.rglob('*') if p.is_file() and not IGNORED.intersection(p.relative_to(ROOT).parts)]

def check(files):
    issues=[]
    for path in files:
        name=path.relative_to(ROOT).as_posix()
        parts=Path(name).parts
        if (FORBIDDEN.intersection(parts) or path.name in BLOCKED_NAMES or path.suffix.lower() in MEDIA or
            path.name.startswith('.env') or path.suffix in {'.pem','.key'} or
            name.startswith('workflows/local/') and path.name != '.gitkeep'):
            issues.append((name,'private/generated file must not be published'))
            continue
        if path.is_symlink():
            issues.append((name,'symlink must not be published'));continue
        if not path.is_file(): issues.append((name,'tracked file is missing'));continue
        if path.stat().st_size>20*1024*1024: issues.append((name,'file exceeds 20 MB public-package limit'))
        if INDEXED:
            proc=subprocess.run(['git','show',':'+name],cwd=ROOT,capture_output=True,check=True)
            raw=proc.stdout
        else:
            raw=path.read_bytes()
        if path.suffix.lower()=='.png':
            if not name.startswith('docs/screenshots/'):issues.append((name,'image is outside reviewed screenshot folder'))
            offset=8
            while offset+12 <= len(raw):
                length=int.from_bytes(raw[offset:offset+4], 'big')
                kind=raw[offset+4:offset+8]
                if length>len(raw)-offset-12:
                    issues.append((name,'invalid PNG chunk'));break
                if kind in {b'tEXt',b'iTXt',b'eXIf'}:
                    issues.append((name,'PNG contains metadata chunks; inspect before publishing'));break
                offset+=length+12
                if kind==b'IEND':break
            continue
        try: text=raw.decode('utf-8')
        except UnicodeDecodeError:
            issues.append((name,'unexpected binary file'));continue
        for label,pattern in PATTERNS.items():
            if pattern.search(text):issues.append((name,label))
        if name.startswith('workflows/') and path.suffix=='.json':
            def inspect(value):
                if isinstance(value,dict):
                    for key,v in value.items():
                        if re.search(r'(?:api[_-]?key|password|authorization|access[_-]?token|client[_-]?secret)$',key,re.I) and isinstance(v,str) and v.strip():
                            issues.append((name,'nonempty credential field in workflow'))
                        inspect(v)
                elif isinstance(value,list):
                    for v in value:inspect(v)
            try:inspect(json.loads(text))
            except ValueError:issues.append((name,'invalid workflow JSON'))
    return issues

if __name__=='__main__':
    try:
        files=candidates();issues=check(files)
    except (OSError,ValueError) as error:
        print('Release scan failed:',error);sys.exit(1)
    for name,label in issues:print(name+': '+label)
    if issues:
        print(str(len(issues))+' release check(s) failed. Candidate values have not been printed.');sys.exit(1)
    print('PASS: '+str(len(files))+' public files checked; no blocked content or credential patterns found.')
