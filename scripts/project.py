"""Project layout and validation shared by checking and release packaging."""
from pathlib import Path
import json,posixpath,re,struct
ROOT=Path(__file__).resolve().parent.parent

def runtime_files(root=ROOT):
    files=['manifest.json']
    files += [p.relative_to(root).as_posix() for folder in ['src','assets/icons','_locales'] for p in sorted((root/folder).rglob('*')) if p.is_file() and p.suffix in {'.js','.html','.css','.png','.svg','.json'}]
    return files

def validate(root=ROOT):
    m=json.loads((root/'manifest.json').read_text())
    assert m['manifest_version']==3
    assert len(m['name'])<=75 and len(m['description'])<=132 and len(m['short_name'])<=12
    catalogs={locale:json.loads((root/f'_locales/{locale}/messages.json').read_text()) for locale in ['en','ru']}
    assert m['default_locale']=='en' and catalogs['en'].keys()==catalogs['ru'].keys()
    for locale,catalog in catalogs.items():
        assert len(catalog['extensionName']['message'])<=75 and len(catalog['extensionDescription']['message'])<=132
        for key in re.findall(r'__MSG_(\w+)__',json.dumps(m)):assert catalog.get(key,{}).get('message'),f'Missing manifest translation: {locale}/{key}'
    source=(root/'src/shared/messages.js').read_text()
    messages=json.loads(source.split('Object.freeze(',1)[1].split(');',1)[0])
    assert messages and all(isinstance(key,str) and isinstance(value,str) and value for key,value in messages.items())
    for key,value in messages.items():
        assert set(re.findall(r'\{(\w+)\}',key))==set(re.findall(r'\{(\w+)\}',value)),f'Translation placeholders differ: {key}'
    allowed=set(runtime_files(root))
    paths_source=(root/'src/shared/paths.js').read_text()
    paths=dict(re.findall(r"(\w+)\s*:\s*'([^']+)'",paths_source))
    assert paths['panel']==m['side_panel']['default_path']
    assert paths['search'] in m['web_accessible_resources'][0]['resources']
    for name in paths.values():assert name in allowed,f'Missing centralized path: {name}'
    manifest_paths=[m['background']['service_worker'],m['side_panel']['default_path']]
    manifest_paths += [p for group in m['content_scripts'] for p in group['js']]
    manifest_paths += [p for group in m['web_accessible_resources'] for p in group['resources']]
    manifest_paths += list(m['icons'].values())+list(m['action']['default_icon'].values())
    for name in manifest_paths:assert name in allowed,f'Missing manifest resource: {name}'
    for name in allowed:
        if Path(name).suffix not in {'.js','.html','.css'}:continue
        text=(root/name).read_text()
        refs=[]
        if name.endswith('.js'):
            refs+=re.findall(r'''(?:from\s*|import\s*)["'](\.[^"']+)["']''',text)
            for call in re.findall(r'\bimportScripts\((.*?)\)',text,re.S):refs+=re.findall(r'''["']([^"']+)["']''',call)
            for key in re.findall(r'\bSpacePaths\.(\w+)',text):assert key in paths,f'Unknown SpacePaths key: {name}: {key}'
            for literal in re.findall(r'''getURL\(["']([^"']+)["']\)''',text):
                if not literal.startswith('_favicon/'):
                    assert literal.split('?')[0] in allowed,f'Invalid extension URL: {name}: {literal}'
        if name.endswith('.html'):
            refs+=re.findall(r'''(?:src|href)=["']([^"']+)["']''',text)
            assert '<html lang="en">' in text,f'Wrong document language: {name}'
        for ref in refs:
            if ref.startswith(('https://','http://','#','data:')):continue
            target=posixpath.normpath(posixpath.join(posixpath.dirname(name),ref.split('?')[0]))
            assert target in allowed,f'Missing dependency: {name} -> {ref} ({target})'
        for key in re.findall(r"\bt\('([^'\n]+)'",text):
            assert key in messages,f'Missing Russian UI translation: {name}: {key}'
        for key in re.findall(r'data-i18n(?:-[\w-]+)?="([^"]+)"',text):
            import html
            assert html.unescape(key) in messages,f'Missing Russian markup translation: {name}: {key}'
    # Content-script preload order must also work on tabs opened before an update.
    preload=m['content_scripts'][0]['js']
    assert preload.index(paths['paths'])<preload.index(paths['sidebar'])
    assert preload.index(paths['settings'])<preload.index(paths['sidebar'])
    assert preload.index(paths['messages'])<preload.index(paths['i18n'])<preload.index(paths['sidebar'])
    for page in [paths['panel'],paths['search']]:
        text=(root/page).read_text()
        assert text.index('paths.js')<text.index('messages.js')<text.index('i18n.js')<text.index('theme-bootstrap.js')
    print(f'Validated {len(allowed)} runtime files, manifest, module graph, centralized URLs, and English/Russian localization.')
    return m,sorted(allowed)

if __name__=='__main__':validate()
