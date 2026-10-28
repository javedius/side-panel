#!/usr/bin/env python3
"""Render the existing vector brand as store artwork; no simulated screenshots."""
from pathlib import Path
import html
from PIL import Image, ImageDraw, ImageFont, ImageChops
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'store'/'assets'
SOURCE=ROOT/'store'/'source'
SCALE=3
INK='#181818'; PAPER='#ededeb'; MUTED='#a5a5a0'; LINE='#343434'
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
UNICODE='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
class Art:
    def __init__(self,w,h,bg):
        self.w,self.h=w,h
        self.im=Image.new('RGBA',(w*SCALE,h*SCALE),bg)
        self.d=ImageDraw.Draw(self.im)
        self.svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">']
        if bg!=(0,0,0,0): self.svg.append(f'<rect width="{w}" height="{h}" fill="{bg}"/>')
    def rect(self,x,y,w,h,fill,r=0,stroke=None,sw=1):
        box=tuple(round(v*SCALE) for v in (x,y,x+w,y+h))
        self.d.rounded_rectangle(box,round(r*SCALE),fill=fill,outline=stroke,width=max(1,round(sw*SCALE)))
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill or "none"}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>')
    def line(self,points,color,width=1):
        self.d.line([(round(x*SCALE),round(y*SCALE)) for x,y in points],fill=color,width=max(1,round(width*SCALE)),joint='curve')
        self.svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>')
    def circle(self,x,y,r,color,stroke=None,sw=1):
        self.d.ellipse(tuple(round(v*SCALE) for v in (x-r,y-r,x+r,y+r)),fill=color,outline=stroke,width=max(1,round(sw*SCALE)))
        self.svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color or "none"}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>')
    def text(self,x,y,text,size,color=PAPER,bold=False,unicode=False):
        f=ImageFont.truetype(UNICODE if unicode else BOLD if bold else FONT,round(size*SCALE))
        self.d.text((round(x*SCALE),round(y*SCALE)),text,font=f,fill=color,anchor='lt')
        self.svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(text)}</text>')
    def logo(self,x,y,size,color=PAPER):
        k=size/24
        self.rect(x+2.5*k,y+2.5*k,13*k,13*k,None,4*k,color,2.5*k)
        self.rect(x+9*k,y+9*k,13*k,13*k,color,4*k)
    def save(self,name,alpha=False):
        im=self.im.resize((self.w,self.h),Image.Resampling.LANCZOS)
        if alpha:
            # Keep the required border fully transparent after antialiasing.
            mask=Image.new('L',im.size,0);ImageDraw.Draw(mask).rectangle((16,16,111,111),fill=255)
            im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
        if not alpha:im=im.convert('RGB')
        im.save(OUT/(name+'.png'),optimize=True)
        (SOURCE/(name+'.svg')).write_text('\n'.join(self.svg+['</svg>']))
        return im

def symbol(a,cx,cy,i,color=MUTED,scale=1):
    r=7*scale
    if i%3==0:
        a.rect(cx-r,cy-r*.7,r*2,r*1.4,None,2*scale,color,1.4*scale)
        a.line([(cx-r,cy-r*.7),(cx,cy+r*.1),(cx+r,cy-r*.7)],color,1.2*scale)
    elif i%3==1:
        a.rect(cx-r*.7,cy-r,r*1.4,r*2,None,2*scale,color,1.4*scale)
        a.line([(cx-r*.3,cy-r*.2),(cx+r*.3,cy-r*.2)],color,1.2*scale)
        a.line([(cx-r*.3,cy+r*.3),(cx+r*.2,cy+r*.3)],color,1.2*scale)
    else:
        a.circle(cx,cy,r,None,color,1.4*scale)
        a.line([(cx-r,cy),(cx+r,cy)],color,1.2*scale)
        a.line([(cx,cy-r),(cx,cy+r)],color,1.2*scale)

# Icon: front-facing 96px artwork with a true 16px transparent border.
a=Art(128,128,(0,0,0,0));a.rect(16,16,96,96,INK,24);a.logo(28,28,72)
icon=a.save('icon-128',True)
# The same icon is used by the packaged extension; small toolbar marks remain unchanged.
icon.save(ROOT/'assets'/'icons'/'space-128.png',optimize=True)

# Small tile: brand and an abstract grid, deliberately not a screenshot.
a=Art(440,280,INK)
a.logo(30,38,48);a.text(31,132,'Space',46,bold=True)
a.rect(234,12,180,258,'#202020',20,LINE)
a.rect(250,30,180,258,'#272727',20,'#464641')
for i in range(9):
    x=265+(i%3)*48;y=53+(i//3)*48
    a.rect(x,y,40,40,'#303030',9)
    symbol(a,x+20,y+20,i,'#c6c6bf',.8)
a.rect(265,217,88,6,'#a5a5a0',3);a.rect(265,238,132,5,'#555550',2)
a.rect(265,255,104,5,'#454540',2)
a.save('promo-small-440x280')

# Marquee: same restrained identity, with schematic feature illustration.
a=Art(1400,560,INK)
a.logo(68,54,44);a.text(128,62,'Space',32,bold=True)
a.text(72,165,'Your sites, tabs,',58,bold=True)
a.text(72,239,'and quick search.',58,bold=True)
a.text(75,341,'One space. Less searching.',24,MUTED)
a.rect(73,434,171,40,'#242424',10,LINE)
a.text(91,443,'⌘K / Alt+K',19,'#c6c6bf',unicode=True)
a.text(265,445,'Open and find',18,MUTED)
# Overlapping cards echo the mark; all UI below is promotional illustration.
a.rect(954,34,326,454,'#202020',20,LINE)
a.rect(976,56,326,454,'#242424',20,'#464641')
a.logo(998,77,25);a.text(1034,81,'Space',20,bold=True)
for i in range(9):
    x=998+(i%3)*94;y=128+(i//3)*70
    a.rect(x,y,82,58,'#303030',10)
    symbol(a,x+41,y+27,i,'#c6c6bf',1.15)
a.text(998,361,'Spaces',12,MUTED)
a.line([(1000,395),(1005,400),(1000,405)],MUTED,1.6);a.text(1019,391,'Work',16)
a.line([(1000,434),(1005,439),(1000,444)],MUTED,1.6);a.text(1019,430,'Personal',16)
# Floating compact search, about a quarter below the artwork top, kept distinct from a browser capture.
a.rect(855,272,470,54,'#111111',16)
a.rect(849,265,470,54,'#f5f5f3',16,'#c2c2bb')
symbol(a,874,292,2,'#64645d',.95)
a.text(896,282,'Search…',18,'#64645d')
a.line([(1286,292),(1300,292),(1295,287)],'#64645d',1.5)
a.line([(1300,292),(1295,297)],'#64645d',1.5)
a.save('promo-marquee-1400x560')

# Local review sheet, never uploaded as a store screenshot.
a=Art(1440,1010,'#f5f5f3')
a.text(52,35,'Space / Chrome Web Store',28,'#252522',True)
a.text(52,86,'Promotional artwork and icon',16,'#64645d')
marquee=Image.open(OUT/'promo-marquee-1400x560.png').convert('RGBA').resize((1320*SCALE,528*SCALE),Image.Resampling.LANCZOS)
a.im.alpha_composite(marquee,(52*SCALE,132*SCALE))
small=Image.open(OUT/'promo-small-440x280.png').convert('RGBA').resize((440*SCALE,280*SCALE),Image.Resampling.LANCZOS)
a.im.alpha_composite(small,(52*SCALE,690*SCALE))
a.im.alpha_composite(icon.resize((128*SCALE,128*SCALE),Image.Resampling.LANCZOS),(555*SCALE,710*SCALE))
a.text(555,860,'128 × 128',16,'#64645d')
a.text(760,715,'Space',38,'#252522',True)
a.text(760,781,'Sidebar and quick search',20,'#64645d')
a.text(760,835,'Promo 440 × 280 / 1400 × 560',16,'#64645d')
a.text(760,877,'Actual interface screenshots are supplied separately.',14,'#64645d')
a.im.resize((a.w,a.h),Image.Resampling.LANCZOS).convert('RGB').save(OUT/'preview.jpg',quality=93)
print('Rendered icon, two promotional images, editable SVG sources and review sheet.')
