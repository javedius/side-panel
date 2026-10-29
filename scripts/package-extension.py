#!/usr/bin/env python3
"""Build the extension and a separate English Chrome Web Store handoff."""
from pathlib import Path
import hashlib,json,struct,zipfile
import sys
sys.dont_write_bytecode=True
from project import ROOT,validate
RELEASE=ROOT/'release';STORE=ROOT/'store'
RELEASE.mkdir(exist_ok=True)
m,runtime=validate();version=m['version']

def png(path,size,color_type):
    data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n',path
    w,h,depth,kind=struct.unpack('>IIBB',data[16:26])
    assert (w,h)==size and depth==8 and kind==color_type,(path,(w,h),depth,kind)

for name,size,kind in [('icon-128',(128,128),6),('promo-small-440x280',(440,280),2),('promo-marquee-1400x560',(1400,560),2)]:
    png(STORE/'assets'/(name+'.png'),size,kind)
assert (ROOT/m['icons']['128']).read_bytes()==(STORE/'assets/icon-128.png').read_bytes()
listing=(STORE/'listing.en.txt').read_text()
catalog=json.loads((ROOT/'_locales/en/messages.json').read_text())
name=catalog['extensionName']['message'];description=catalog['extensionDescription']['message']
assert name in listing and description in listing
previews=json.loads((STORE/'screenshots/previews.json').read_text())
assert previews['actualBrowserCapture'] is False and previews['version']==version
assert 1<=len(previews['files'])<=5
preview_files=[]
for entry in previews['files']:
    path=STORE/'screenshots'/entry['file'];png(path,(1280,800),2);preview_files.append(path)
carousel=RELEASE/f'space-carousel-{version}.zip'
with zipfile.ZipFile(carousel,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as out:
    out.comment=b'Space interface illustrations with example data; not live browser captures.'
    for path in preview_files:out.write(path,path.name)
metadata={'name':name,'shortDescription':description,'longDescription':listing.split('FULL DESCRIPTION\n',1)[1].strip(),'version':version,'language':'en','category':'Functionality & UI','privacyPolicyUrl':None,'screenshotFiles':[],'interfacePreviewFiles':[path.relative_to(STORE).as_posix() for path in preview_files],'carouselArchive':carousel.name,'readyToSubmit':False,'pending':['Capture at least one real current-version screenshot','Host the privacy page at a public HTTPS URL','Complete publisher and data-practices fields in the dashboard']}
(RELEASE/'listing.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
assert f'version {version}' in (ROOT/'src/privacy/index.html').read_text()
archive=RELEASE/f'space-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as out:
    for name in runtime:out.write(ROOT/name,name)
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None and set(check.namelist())==set(runtime)
    assert json.loads(check.read('manifest.json'))==m
checks=[archive,STORE/'assets/icon-128.png',STORE/'assets/promo-small-440x280.png',STORE/'assets/promo-marquee-1400x560.png',*preview_files,carousel]
sums='\n'.join(hashlib.sha256(path.read_bytes()).hexdigest()+'  '+('upload/'+path.name if path==archive else 'carousel/'+path.name if path==carousel else path.relative_to(STORE).as_posix()) for path in checks)+'\n'
(RELEASE/'SHA256SUMS.txt').write_text(sums)
kit=RELEASE/f'space-web-store-kit-{version}.zip'
with zipfile.ZipFile(kit,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as out:
    out.write(archive,'upload/'+archive.name)
    out.write(carousel,'carousel/'+carousel.name)
    for path in sorted(STORE.rglob('*')):
        if path.is_file() and path.name!='.DS_Store':out.write(path,path.relative_to(STORE).as_posix())
    for path in sorted((ROOT/'src/privacy').rglob('*')):
        if path.is_file():out.write(path,'privacy/'+path.name)
    for name in ['listing.json','SHA256SUMS.txt']:out.write(RELEASE/name,name)
print(f'Extension: {archive} ({len(runtime)} files, {archive.stat().st_size:,} bytes)')
print(f'Carousel: {carousel} ({len(preview_files)} images)')
print(f'Store kit: {kit} ({kit.stat().st_size:,} bytes)')
print('Real screenshots and a public privacy-policy URL remain pending.')
