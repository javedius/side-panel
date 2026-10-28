#!/usr/bin/env python3
"""Create honest interface illustrations, not browser captures.

Colors and search results come from maintained runtime modules. Geometry follows
src/panel/styles.css and src/search/styles.css. No browser/profile is accessed.
Requires Pillow; output is opaque 1280x800 PNG plus editable SVG.
"""
from pathlib import Path
import base64
import hashlib
import html
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'store/screenshots/global'
SOURCE = ROOT / 'store/screenshots/source'
SCALE = 2
FONT_CANDIDATES = [
    ('/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
]
REGULAR, BOLD = next(pair for pair in FONT_CANDIDATES if all(Path(p).exists() for p in pair))
UNICODE = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
if not Path(UNICODE).exists():
    UNICODE = REGULAR
runtime = subprocess.run(['node', '--input-type=module', '-e', """
import './src/shared/ui-settings.js';
import './src/search/model.js';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('store/screenshots/source/examples.json','utf8'));
console.log(JSON.stringify({dark:SpaceUi.themeTokens('dark'),light:SpaceUi.themeTokens('light'),
  matches:SpaceSearch.matches(data.query,data.tabs,data.sites,data.spaceConfig,1),data}));
"""], cwd=ROOT, capture_output=True, check=True, text=True)
DATA = json.loads(runtime.stdout)


class Art:
    def __init__(self, background):
        self.im = Image.new('RGBA', (1280*SCALE, 800*SCALE), background)
        self.draw = ImageDraw.Draw(self.im)
        self.svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">',
                    '<title>Space interface illustration with example data</title>',
                    f'<rect width="1280" height="800" fill="{background}"/>']

    def rect(self, x, y, w, h, fill, radius=0, stroke=None, width=1):
        coords = tuple(round(v*SCALE) for v in (x, y, x+w, y+h))
        self.draw.rounded_rectangle(coords, round(radius*SCALE), fill=fill, outline=stroke, width=max(1, round(width*SCALE)))
        self.svg.append(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{radius:g}" fill="{fill or "none"}"'
                        + (f' stroke="{stroke}" stroke-width="{width:g}"' if stroke else '') + '/>')

    def line(self, points, color, width=1):
        self.draw.line([(round(x*SCALE), round(y*SCALE)) for x, y in points], fill=color, width=max(1, round(width*SCALE)), joint='curve')
        self.svg.append('<polyline points="'+' '.join(f'{x:g},{y:g}' for x, y in points)
                        +f'" fill="none" stroke="{color}" stroke-width="{width:g}" stroke-linecap="round" stroke-linejoin="round"/>')

    def text(self, x, y, value, size, color, bold=False, center=False, unicode=False, max_width=None):
        face = UNICODE if unicode else BOLD if bold else REGULAR
        font = ImageFont.truetype(face, round(size*SCALE))
        if max_width:
            full = value
            while self.draw.textlength(value, font=font) > max_width*SCALE and len(full) > 1:
                full = full[:-1]
                value = full.rstrip()+'…'
        if center:
            x -= self.draw.textlength(value, font=font)/SCALE/2
        self.draw.text((round(x*SCALE), round(y*SCALE)), value, font=font, fill=color, anchor='lt')
        self.svg.append(f'<text x="{x:g}" y="{y:g}" dominant-baseline="text-before-edge" font-family="Arial,sans-serif" font-size="{size:g}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(value)}</text>')

    def logo(self, x, y, size, color):
        k = size/24
        self.rect(x+2.5*k, y+2.5*k, 13*k, 13*k, None, 4*k, color, 2.5*k)
        self.rect(x+9*k, y+9*k, 13*k, 13*k, color, 4*k)

    def globe(self, x, y, size, color):
        for left, top, right, bottom in [(x+2,y+2,x+size-2,y+size-2), (x+size*.32,y+2,x+size*.68,y+size-2)]:
            self.draw.ellipse(tuple(round(v*SCALE) for v in (left,top,right,bottom)), outline=color, width=max(1,round(SCALE*1.3)))
            self.svg.append(f'<ellipse cx="{(left+right)/2:g}" cy="{(top+bottom)/2:g}" rx="{(right-left)/2:g}" ry="{(bottom-top)/2:g}" fill="none" stroke="{color}" stroke-width="1.3"/>')
        self.line([(x+2,y+size/2),(x+size-2,y+size/2)],color,1.3)

    def icon(self, name, x, y, size, fallback):
        path = SOURCE/'icons'/f'{name}.png'
        if not path.exists():
            self.globe(x,y,size,fallback)
            return
        icon = Image.open(path).convert('RGBA')
        factor = size*SCALE/max(icon.size)
        icon = icon.resize((round(icon.width*factor),round(icon.height*factor)),Image.Resampling.LANCZOS)
        self.im.alpha_composite(icon, (round(x*SCALE)+(round(size*SCALE)-icon.width)//2, round(y*SCALE)+(round(size*SCALE)-icon.height)//2))
        encoded = base64.b64encode(path.read_bytes()).decode()
        self.svg.append(f'<image x="{x:g}" y="{y:g}" width="{size:g}" height="{size:g}" href="data:image/png;base64,{encoded}"/>')

    def shadow(self, x, y, w, h, radius=12, opacity=65):
        layer=Image.new('RGBA', self.im.size)
        draw=ImageDraw.Draw(layer)
        draw.rounded_rectangle(tuple(round(v*SCALE) for v in (x,y+7,x+w,y+h+7)), radius=round(radius*SCALE), fill=(0,0,0,opacity))
        self.im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(15*SCALE)))
        self.draw=ImageDraw.Draw(self.im)
        # The vector source keeps the same structure without rasterizing the UI.

    def save(self, stem):
        OUT.mkdir(parents=True,exist_ok=True)
        image=self.im.resize((1280,800),Image.Resampling.LANCZOS).convert('RGB')
        image.save(OUT/f'{stem}.png',optimize=True)
        (SOURCE/f'{stem}.svg').write_text('\n'.join(self.svg+['</svg>']))
        return {'file':f'global/{stem}.png','width':1280,'height':800,'mode':'RGB'}


def plus(a,x,y,size,color):
    a.line([(x-size/2,y),(x+size/2,y)],color,1.5)
    a.line([(x,y-size/2),(x,y+size/2)],color,1.5)


def chevron(a,x,y,color,open=False,scale=1):
    pts=[(x-3,y-2),(x,y+1),(x+3,y-2)] if open else [(x-2,y-3),(x+1,y),(x-2,y+3)]
    a.line(pts,color,1.5*scale)


def brand(a,light=False):
    colors=DATA['light' if light else 'dark']
    a.logo(64,48,30,colors['--text'])
    a.text(106,51,'Space',25,colors['--text'],True)


def pill(a,x,y,label,light=False,width=150):
    c=DATA['light' if light else 'dark']
    a.rect(x,y,width,40,c['--surface'],8,c['--line'])
    a.text(x+width/2,y+13,label,15,c['--secondary-text'],center=True,unicode=True)


def footer_note(a,light=False):
    c=DATA['light' if light else 'dark']
    a.text(68,750,'Interface illustration · Example data',11,c['--muted'])


def panel(a,x,y,w,h,theme='dark'):
    c=DATA[theme];k=w/360
    a.shadow(x,y,w,h,12*k)
    a.rect(x,y,w,h,c['--bg'],12*k,c['--strong-line'])
    def tx(xx,yy,value,size=13,color=None,bold=False,center=False,max_width=None):
        a.text(x+xx*k,y+yy*k,value,size*k,color or c['--text'],bold,center,max_width=max_width*k if max_width else None)
    def box(xx,yy,ww,hh,fill,r=6,stroke=None):
        a.rect(x+xx*k,y+yy*k,ww*k,hh*k,fill,r*k,stroke)
    a.logo(x+24*k,y+24*k,20*k,c['--text']);tx(53,26,'Space',17,bold=True)
    tx(300,25,'···',18,c['--muted']);tx(331,25,'×',20,c['--muted'])
    tile_h=min(76,max(40,(h/k-280)/5))
    favorites=[s for s in DATA['data']['sites'] if s['section']=='favorites']
    for i in range(6):
        col,row=i%3,i//3;xx=16+col*112;yy=66+row*(tile_h+8)
        box(xx,yy,104,tile_h,c['--surface'] if i<len(favorites) else c['--bg'],10,c['--line'] if i==len(favorites) else None)
        if i<len(favorites):
            site=favorites[i]
            a.icon(site['id'],x+(xx+40)*k,y+(yy+tile_h/2-21)*k,24*k,c['--muted'])
            tx(xx+52,yy+tile_h/2+13,site['name'],10,c['--secondary-text'],center=True)
        else:plus(a,x+(xx+52)*k,y+(yy+tile_h/2)*k,17*k,c['--muted'])
    yy=66+tile_h*2+8+28
    tx(24,yy+8,'Spaces',11,c['--muted']);plus(a,x+325*k,y+(yy+14)*k,12*k,c['--muted'])
    yy+=32
    chevron(a,x+34*k,y+(yy+20)*k,c['--muted'],True,k)
    tx(54,yy+14,'Work',13);tx(93,yy+15,'1',11,c['--muted'])
    yy+=40
    tx(29,yy+15,'D',12,c['--muted'],True)
    tx(54,yy+9,'Design resources',13,max_width=240);tx(54,yy+27,'example.com',10,c['--muted'])
    yy+=46
    chevron(a,x+34*k,y+(yy+20)*k,c['--muted'],False,k)
    tx(54,yy+14,'Personal',13);tx(111,yy+15,'1',11,c['--muted'])
    yy+=62
    tx(24,yy+8,'Tabs',11,c['--muted']);tx(55,yy+9,'2',10,c['--muted'])
    plus(a,x+325*k,y+(yy+14)*k,13*k,c['--muted'])
    yy+=34
    for i,tab in enumerate(DATA['data']['tabs']):
        top=yy+i*44
        if tab['active']:box(16,top,322,40,c['--active'],6)
        tx(29,top+14,'D' if i==0 else 'P',12,c['--muted'],True)
        tx(54,top+13,tab['title'],13,max_width=245)
    deck=h/k-62
    tx(22,deck+8,'Media in your tabs',11)
    tx(22,deck+26,'Start playback on a site',10,c['--muted'])
    # The actual footer has no media source here, so controls are disabled.
    color='#666662' if theme=='dark' else '#b4b4ad'
    for i,symbol in enumerate(['|‹','↶','▶','›|']):
        a.text(x+(239+i*29)*k,y+(deck+17)*k,symbol,15*k,color,unicode=True)


def overview(light=False):
    c=DATA['light' if light else 'dark'];a=Art(c['--bg'])
    brand(a,light)
    if light:
        lines=['Same calm.','A lighter look.'];desc=['Light and dark themes.','A sidebar that fits your day.']
    else:
        lines=['Your sites.','Within reach.'];desc=['Favorites, spaces, and tabs.','One quiet place for every day.']
    for i,line in enumerate(lines):a.text(68,205+i*69,line,58,c['--text'],True)
    for i,line in enumerate(desc):a.text(71,392+i*31,line,21,c['--muted'])
    a.line([(72,492),(106,492)],c['--strong-line'],2)
    a.text(72,518,'Save what matters.',16,c['--secondary-text'])
    a.text(72,548,'Find it when you need it.',16,c['--secondary-text'])
    pill(a,70,626,'⌘J / Alt+J',light)
    a.text(240,639,'Toggle the sidebar',14,c['--muted'])
    panel(a,756,38,440,724,'light' if light else 'dark')
    footer_note(a,light)
    return a.save('03-light-theme' if light else '01-sidebar')


def search():
    c=DATA['dark'];a=Art(c['--bg']);brand(a)
    pill(a,1035,47,'⌘K / Alt+K',width=177)
    # A neutral backdrop gives context without fabricating a website or browser chrome.
    for xx,ww in [(112,230),(375,768)]:
        a.rect(xx,150,ww,360,'#1c1c1c',12)
        for row in range(6):a.rect(xx+25,183+row*43,min(ww-50,490-row*31),5,'#242424',2)
    k=1.5;x=280;y=200;w=480*k
    matches=DATA['matches'];h=(54+8+len(matches)*47)*k
    a.shadow(x,y,w,h,16*k,95)
    a.rect(x,y,w,h,c['--bg'],16*k,c['--edit-line'])
    a.icon('google',x+14*k,y+18*k,16*k,c['--muted'])
    a.text(x+40*k,y+17*k,DATA['data']['query'],16*k,c['--text'])
    a.text(x+w-62*k,y+17*k,'×',18*k,c['--muted'])
    a.line([(x+w-38*k,y+27*k),(x+w-23*k,y+27*k),(x+w-29*k,y+21*k)],c['--muted'],1.6*k)
    a.line([(x+w-23*k,y+27*k),(x+w-29*k,y+33*k)],c['--muted'],1.6*k)
    a.line([(x+8*k,y+54*k),(x+w-8*k,y+54*k)],c['--line'])
    for i,item in enumerate(matches):
        top=y+(62+i*47)*k
        a.text(x+18*k,top,item['title'],13*k,c['--text'])
        a.text(x+18*k,top+20*k,item['detail'],10*k,c['--muted'])
    a.text(68,578,'One shortcut. Every destination.',48,c['--text'],True)
    a.text(71,653,'Switch tabs, open saved sites, or search the web.',21,c['--muted'])
    footer_note(a)
    return a.save('02-quick-search')


if __name__=='__main__':
    files=[overview(),search(),overview(True)]
    sources=['src/panel/styles.css','src/search/styles.css','src/shared/ui-settings.js','src/search/model.js']
    manifest={'kind':'interface-illustrations','actualBrowserCapture':False,'version':json.loads((ROOT/'manifest.json').read_text())['version'],
              'data':'source/examples.json','renderer':'scripts/render-screenshots.py','files':files,
              'sourceHashes':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sources}}
    (OUT.parent/'previews.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for item in files:
        path=OUT.parent/item['file']
        image=Image.open(path)
        assert image.size==(1280,800) and image.mode=='RGB'
        print(f'{path.relative_to(ROOT)}: 1280x800 RGB, {path.stat().st_size:,} bytes')
