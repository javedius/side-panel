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
from urllib.parse import urlsplit
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
SERIF = next(str(path) for path in [Path('/System/Library/Fonts/Supplemental/Times New Roman.ttf'), Path('/System/Library/Fonts/Supplemental/Georgia.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf')] if path.exists())
UNICODE = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
if not Path(UNICODE).exists():
    UNICODE = REGULAR
runtime = subprocess.run(['node', '--input-type=module', '-e', """
import './src/shared/ui-settings.js';
import './src/search/model.js';
import './src/backup/model.js';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('store/screenshots/source/examples.json','utf8'));
console.log(JSON.stringify({dark:SpaceUi.themeTokens('dark'),light:SpaceUi.themeTokens('light'),
  matches:SpaceSearch.matches(data.query,data.tabs,data.sites,data.spaceConfig,1),
  backup:SpaceBackup.create({sites:data.sites,spaceConfig:data.spaceConfig,uiSettings:SpaceUi.normalize({language:'en',theme:'light'})}),data}));
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

    def text(self, x, y, value, size, color, bold=False, center=False, unicode=False, max_width=None, serif=False):
        face = SERIF if serif else UNICODE if unicode else BOLD if bold else REGULAR
        font = ImageFont.truetype(face, round(size*SCALE))
        if max_width:
            full = value
            while self.draw.textlength(value, font=font) > max_width*SCALE and len(full) > 1:
                full = full[:-1]
                value = full.rstrip()+'…'
        if center:
            x -= self.draw.textlength(value, font=font)/SCALE/2
        self.draw.text((round(x*SCALE), round(y*SCALE)), value, font=font, fill=color, anchor='lt')
        self.svg.append(f'<text x="{x:g}" y="{y:g}" dominant-baseline="text-before-edge" font-family="{'Times New Roman,Georgia,serif' if serif else 'Arial,sans-serif'}" font-size="{size:g}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(value)}</text>')

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


def website_icon(a,url,x,y,size,fallback):
    host=urlsplit(url).hostname or ''
    for name,domain in [('google','google.com'),('github','github.com'),('youtube','youtube.com'),('figma','figma.com'),('wikipedia','wikipedia.org')]:
        if host==domain or host.endswith('.'+domain):
            a.icon(name,x,y,size,fallback)
            return
    a.globe(x,y,size,fallback)


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
    resource=next(site for site in DATA['data']['sites'] if site['id']=='resources')
    website_icon(a,resource['url'],x+24*k,y+(yy+12)*k,20*k,c['--muted'])
    tx(54,yy+9,resource['name'],13,max_width=240);tx(54,yy+27,urlsplit(resource['url']).hostname,10,c['--muted'])
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
        website_icon(a,tab['url'],x+24*k,y+(top+10)*k,20*k,c['--muted'])
        tx(54,top+13,tab['title'],13,max_width=245)
    deck=h/k-62
    tx(22,deck+8,'Media in your tabs',11)
    tx(22,deck+26,'Start playback on a site',10,c['--muted'])
    # The actual footer has no media source here, so controls are disabled.
    color='#666662' if theme=='dark' else '#b4b4ad'
    for i,symbol in enumerate(['|‹','↶','▶','›|']):
        a.text(x+(239+i*29)*k,y+(deck+17)*k,symbol,15*k,color,unicode=True)


# Store-gallery treatment: warm white, editorial serif, orange emphasis,
# pastel feature chips, and a large illustrative browser window.
PAPER='#fffdfb'
INK='#111827'
ORANGE='#ef4c18'
SOFT_TEXT='#606977'
REFERENCE='https://chromewebstore.google.com/detail/ziziyi-space-chat-with-we/lilckelmopbcffmglfmfhelaajhjpcff?hl=en-US'


def gallery_canvas():
    a=Art(PAPER)
    top=(255,246,240);bottom=(255,255,255)
    for row in range(800*SCALE):
        t=row/(800*SCALE-1)
        color=tuple(round(x+(y-x)*t) for x,y in zip(top,bottom))
        a.draw.line([(0,row),(1280*SCALE,row)],fill=color)
    a.svg.append('<defs><linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff6f0"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="1280" height="800" fill="url(#paper)"/>')
    a.logo(40,35,34,INK)
    a.text(88,39,'Space',30,INK,True)
    return a


def feature_icon(a,kind,x,y,color):
    if kind=='grid':
        for row in range(2):
            for col in range(2):a.rect(x+col*12,y+row*12,8,8,None,2,color,1.6)
    elif kind=='folder':
        a.line([(x,y+5),(x,y+1),(x+8,y+1),(x+11,y+5),(x+23,y+5),(x+23,y+21),(x,y+21),(x,y+5)],color,1.7)
    elif kind=='tabs':
        a.rect(x,y,12,22,None,2,color,1.7)
        a.rect(x+16,y,9,22,None,2,color,1.7)
    elif kind=='keyboard':
        a.rect(x-1,y+3,26,17,None,3,color,1.6)
        for row in range(2):
            for col in range(4):a.rect(x+4+col*4,y+7+row*4,1.4,1.4,color,0)
        a.line([(x+7,y+17),(x+18,y+17)],color,1.5)
    elif kind=='sun':
        a.draw.ellipse(tuple(round(v*SCALE) for v in (x+7,y+7,x+17,y+17)),outline=color,width=round(1.7*SCALE))
        a.svg.append(f'<circle cx="{x+12}" cy="{y+12}" r="5" fill="none" stroke="{color}" stroke-width="1.7"/>')
        for dx,dy in [(0,-1),(1,0),(0,1),(-1,0)]:a.line([(x+12+dx*9,y+12+dy*9),(x+12+dx*12,y+12+dy*12)],color,1.7)
    else:a.globe(x,y,24,color)


def editorial_copy(a,lines,description,features):
    for i,(line,accent) in enumerate(lines):a.text(40,137+i*70,line,66,ORANGE if accent else INK,serif=True)
    for i,line in enumerate(description):a.text(42,376+i*29,line,20,SOFT_TEXT)
    colors=[('#fff0e5','#ef6923'),('#f3edff','#8953f4'),('#edf3ff','#3679ed')]
    for i,((label,kind),(background,color)) in enumerate(zip(features,colors)):
        y=484+i*70
        a.rect(40,y,338,56,background,11)
        feature_icon(a,kind,61,y+17,color)
        a.text(104,y+19,label,18,INK,max_width=258,unicode='⌘' in label)
    a.text(42,762,'Interface illustration · Example data',10,'#85858b')


def browser_window(a,x=466,y=42,w=790,h=716):
    a.shadow(x,y,w,h,18,35)
    a.rect(x,y,w,h,'#ffffff',18,'#e9dfda')
    a.rect(x+1,y+1,w-2,40,'#ffebe0',17)
    a.rect(x+1,y+25,w-2,16,'#ffebe0')
    for i,color in enumerate(['#ff6258','#ffbd2e','#28c840']):a.rect(x+17+i*17,y+15,10,10,color,5)
    a.rect(x+88,y+9,210,32,'#ffffff',10)
    a.globe(x+101,y+17,14,'#85858e')
    a.text(x+123,y+17,'Project notes',11,'#4d4d54')
    a.text(x+276,y+16,'×',13,'#707078')
    plus(a,x+317,y+22,10,'#7e6b63')
    # Ordinary browser context is illustrative and contains no account identity.
    a.line([(x+23,y+59),(x+17,y+65),(x+23,y+71)],'#9c9691',1.6)
    a.line([(x+17,y+65),(x+29,y+65)],'#9c9691',1.6)
    a.line([(x+51,y+59),(x+57,y+65),(x+51,y+71)],'#c2b9b2',1.6)
    a.line([(x+45,y+65),(x+57,y+65)],'#c2b9b2',1.6)
    a.text(x+76,y+58,'↻',16,'#9c9691',unicode=True)
    a.rect(x+110,y+47,w-174,32,'#faf7f5',16)
    a.globe(x+122,y+57,13,'#a39b95')
    a.text(x+146,y+59,'example.com / project-notes',11,'#9c9691')
    a.logo(x+w-49,y+56,17,INK)
    a.line([(x,y+86),(x+w,y+86)],'#f0ece9')
    return x+16,y+92,w-32,h-108


def article(a,x,y,w,h):
    a.text(x+18,y+18,'WORKSPACE / NOTES',10,'#a3a5aa')
    title=['A little less clutter.','A little more focus.']
    for i,line in enumerate(title):a.text(x+18,y+53+i*35,line,31,INK,serif=True)
    # Neutral page placeholder, not a claimed feature or copied website.
    hero_y=y+147
    a.rect(x+18,hero_y,w-36,140,'#f5f1ed',12)
    for i,(color,offset) in enumerate([('#eee3da',0),('#e4e7e7',27),('#dbe0e0',57)]):
        a.rect(x+18,hero_y+52+offset,w-36,88-offset,color,12)
    for row,fraction in enumerate([1,.98,.79]):a.rect(x+18,y+310+row*15,(w-36)*fraction,5,'#e6e7ea',2)
    a.text(x+18,y+385,'Make room for good ideas.',18,'#676d77',serif=True)
    for row,fraction in enumerate([1,.92,.97,.68]):a.rect(x+18,y+422+row*15,(w-36)*fraction,5,'#e8e9eb',2)
    if h>550:
        a.rect(x+18,y+512,w-36,65,'#f6f6f7',8)


def search_surface(a,x,y,w,theme='light'):
    c=DATA[theme];k=w/480
    matches=DATA['matches'];h=(54+8+len(matches)*47)*k
    a.shadow(x,y,w,h,16*k,70)
    a.rect(x,y,w,h,c['--bg'],16*k,c['--strong-line'])
    a.icon('google',x+14*k,y+18*k,16*k,c['--muted'])
    a.text(x+40*k,y+17*k,DATA['data']['query'],16*k,c['--text'])
    a.text(x+w-62*k,y+17*k,'×',18*k,c['--muted'])
    a.line([(x+w-38*k,y+27*k),(x+w-23*k,y+27*k),(x+w-29*k,y+21*k)],c['--muted'],1.6*k)
    a.line([(x+w-23*k,y+27*k),(x+w-29*k,y+33*k)],c['--muted'],1.6*k)
    a.line([(x+8*k,y+54*k),(x+w-8*k,y+54*k)],c['--line'])
    for i,item in enumerate(matches):
        top=y+(62+i*47)*k
        website_icon(a,item['url'],x+18*k,top+7*k,16*k,c['--muted'])
        a.text(x+44*k,top,item['title'],13*k,c['--text'])
        a.text(x+44*k,top+20*k,item['detail'],10*k,c['--muted'])


def overview():
    a=gallery_canvas()
    editorial_copy(a,[('Your sites,',False),('your tabs,',False),('in one Space.',True)],
                   ['Favorites, spaces, and open tabs.','Everything close to your work.'],
                   [('Your favorite sites','grid'),('Organized spaces','folder'),('All your open tabs','tabs')])
    article_box=browser_window(a)
    article(a,article_box[0],article_box[1],398,article_box[3])
    panel(a,902,134,332,610,'light')
    return a.save('01-sidebar')


def search():
    a=gallery_canvas()
    editorial_copy(a,[('Find it.',False),('Open it.',False),('Keep flowing.',True)],
                   ['One shortcut for tabs, saved sites,','and the web.'],
                   [('⌘K / Alt+K','keyboard'),('Tabs + saved sites','tabs'),('4 search engines','globe')])
    box=browser_window(a)
    article(a,box[0],box[1],box[2],box[3])
    search_surface(a,548,274,620)
    return a.save('02-quick-search')


def detail_context(a):
    box=browser_window(a)
    article(a,box[0],box[1],398,box[3])
    panel(a,902,134,332,610,'light')
    a.text(675,132,'ENLARGED INTERFACE DETAIL',10,'#98918c')


def ui_text(a,x,y,value,size=14,color=None,bold=False,max_width=None):
    a.text(x,y,value,size,color or DATA['light']['--text'],bold,max_width=max_width)


def ui_field(a,x,y,w,label,value,select=False):
    c=DATA['light']
    ui_text(a,x,y,label,12,c['--muted'])
    a.rect(x,y+24,w,42,c['--bg'],10,c['--line'])
    ui_text(a,x+12,y+38,value,14,max_width=w-40)
    if select:chevron(a,x+w-18,y+45,c['--muted'],True)


def ui_button(a,x,y,w,label,primary=False):
    c=DATA['light']
    a.rect(x,y,w,40,c['--accent'] if primary else c['--surface'],10,None if primary else c['--line'])
    a.text(x+w/2,y+13,label,13,c['--primary-text'] if primary else c['--text'],center=True)


def ui_dialog(a,x,y,w,h,title):
    c=DATA['light']
    a.shadow(x,y,w,h,21,65)
    a.rect(x,y,w,h,c['--surface'],21,c['--line'])
    ui_text(a,x+26,y+26,title,19,bold=True)
    ui_text(a,x+w-40,y+23,'×',22,c['--muted'])


def spaces():
    a=gallery_canvas()
    editorial_copy(a,[('A place for',False),('every part',False),('of your day.',True)],
                   ['Keep work, personal links, and hobbies','in spaces you can name and organize.'],
                   [('Create + rename spaces','folder'),('Move sites between spaces','tabs'),('Keep website logos','globe')])
    detail_context(a)
    x,y,w,h=655,200,490,372
    # A real site editor includes a space selector before its Save action.
    ui_dialog(a,x,y-23,w,h+80,'Add site')
    ui_field(a,x+26,y+54,w-52,'Name','Design resources')
    ui_field(a,x+26,y+138,w-52,'Site address','https://www.figma.com/community')
    ui_text(a,x+26,y+225,'Save to',12,DATA['light']['--muted'])
    for i,(label,selected) in enumerate([('Favorites grid',False),('Space',True)]):
        xx=x+28+i*165;yy=y+254
        a.rect(xx,yy,14,14,'#ffffff',7,DATA['light']['--accent'],1)
        if selected:a.rect(xx+4,yy+4,6,6,DATA['light']['--accent'],3)
        ui_text(a,xx+25,yy,label,13)
    ui_field(a,x+26,y+293,w-52,'Space','Work',True)
    ui_button(a,x+w-112,y+381,86,'Save',True)
    return a.save('03-spaces')


def settings():
    a=gallery_canvas()
    editorial_copy(a,[('Your browser,',False),('your rhythm.',True)],
                   ['Choose a theme and a panel mode.','Make Space feel like yours.'],
                   [('Light + dark themes','sun'),('Overlay or native panel','tabs'),('English + Russian','globe')])
    detail_context(a)
    x,y,w,h=655,160,490,546
    ui_dialog(a,x,y,w,h,'Panel settings')
    ui_text(a,x+26,y+80,'Appearance',14,bold=True)
    ui_field(a,x+26,y+111,w-52,'Language','English',True)
    ui_text(a,x+26,y+188,'Uses Chrome’s interface language.',11,DATA['light']['--muted'])
    ui_text(a,x+26,y+206,'Other languages fall back to English.',11,DATA['light']['--muted'])
    ui_field(a,x+26,y+244,w-52,'Theme','Light',True)
    ui_text(a,x+26,y+338,'Panel',14,bold=True)
    ui_field(a,x+26,y+369,w-52,'Panel mode','Overlay',True)
    ui_field(a,x+26,y+455,w-52,'Panel side','Right',True)
    a.rect(x+w-12,y+80,3,h-106,'#eeeeec',1)
    a.rect(x+w-12,y+80,3,93,'#b6b6b0',1)
    return a.save('04-settings')


def backup():
    a=gallery_canvas()
    editorial_copy(a,[('Keep a copy.',False),('Keep your',False),('peace of mind.',True)],
                   ['Save your sites, spaces, and settings.','Preview before restoring your setup.'],
                   [('One JSON backup','folder'),('Preview before import','grid'),('Recover previous data','tabs')])
    detail_context(a)
    x,y,w,h=645,173,510,510
    ui_dialog(a,x,y,w,h,'Backup')
    ui_text(a,x+26,y+80,'Back up your favorites, spaces, and settings',13)
    ui_text(a,x+26,y+102,'in one file.',13)
    ui_button(a,x+26,y+143,164,'Download backup')
    ui_button(a,x+202,y+143,128,'Choose file')
    ui_text(a,x+26,y+205,'JSON file, up to 2 MB. Processed on this device.',12,DATA['light']['--muted'])
    ui_text(a,x+26,y+253,'space-backup-example.json',13,DATA['light']['--muted'])
    data=DATA['backup']['data']
    count=sum(site['section']=='favorites' for site in data['sites'])
    summary=f"Favorites: {count} · Spaces: {len(data['spaceConfig']['spaces'])} · Sites: {len(data['sites'])}"
    ui_text(a,x+26,y+284,summary,14)
    for i,line in enumerate(['Your current sites, spaces, and settings will be replaced.',
                             'Open tabs will stay open. Your previous data will be',
                             'saved for recovery.']):
        ui_text(a,x+26,y+328+i*24,line,13)
    ui_button(a,x+w-275,y+439,96,'Cancel')
    ui_button(a,x+w-165,y+439,139,'Replace data',True)
    return a.save('05-backup')


if __name__=='__main__':
    files=[overview(),search(),spaces(),settings(),backup()]
    sources=['src/panel/styles.css','src/search/styles.css','src/shared/ui-settings.js','src/search/model.js','src/shared/site-icon.js','src/shared/site-icon.css','src/panel/index.html','src/backup/model.js','src/backup/dialog.js']
    manifest={'kind':'interface-illustrations','actualBrowserCapture':False,'browserAccessUsed':False,'version':json.loads((ROOT/'manifest.json').read_text())['version'],
              'data':'source/examples.json','renderer':'scripts/render-screenshots.py','files':files,
              'sourceHashes':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sources},
              'artDirection':{'reference':REFERENCE,'treatment':'Warm white editorial layout, large serif headline with orange emphasis, pastel feature chips, illustrative browser context','applicationThemeChanged':False}}
    (OUT.parent/'previews.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for item in files:
        path=OUT.parent/item['file']
        image=Image.open(path)
        assert image.size==(1280,800) and image.mode=='RGB'
        print(f'{path.relative_to(ROOT)}: 1280x800 RGB, {path.stat().st_size:,} bytes')
