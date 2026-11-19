"""Build Q wardrobe artwork from the six transparent reference sheets and supplemental turnaround angles."""
from argparse import ArgumentParser
from math import cos, sin, pi, radians
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

REFERENCE = {
    'ming': '明服.png',
    'han': '汉服.png',
    'academy': '民国学堂_带尾巴.png',
    'miao': '苗族服饰_带尾巴.png',
    'tibetan': '藏族服饰_带尾巴.png',
    'winter': '都市冬装大衣_带尾巴.png',
}

# Measurements are in the 240 × 310 character frame. The sleeve outlines,
# forward shoe, and original hem are sampled from each costume's own art.
PATTERNS = {
    'ming': {
        'hem': (263, 263, 263),
        'side_foot': (67, 262, 101, 279),
        'sleeve': [(107,190),(129,188),(144,209),(145,224),(137,235),(114,236),(102,223),(105,208)],
        'shoulder': (115,193), 'climb': (69,176,161,176),
    },
    'han': {
        'hem': (265, 264, 264),
        'side_foot': (52, 263, 90, 279),
        'sleeve': [(100,190),(127,190),(138,222),(127,234),(103,236),(100,223)],
        'shoulder': (103,191), 'climb': (66,177,163,177),
    },
    'academy': {
        'hem': (265, 266, 265),
        'side_foot': (76, 264, 130, 279),
        'sleeve': [(106,198),(122,195),(139,207),(150,242),(141,258),(105,261),(98,253)],
        'shoulder': (109,202), 'climb': (72,176,166,176),
    },
    'miao': {
        'hem': (268, 267, 267),
        'side_foot': (75, 266, 105, 279),
        'sleeve': [(90,183),(108,178),(121,192),(130,217),(119,229),(96,227),(91,217)],
        'shoulder': (100,184), 'climb': (72,178,165,178),
    },
    'tibetan': {
        'hem': (264, 264, 263),
        'side_foot': (63, 263, 101, 279),
        'sleeve': [(105,184),(129,184),(145,213),(144,225),(135,235),(111,235),(104,223)],
        'shoulder': (110,187), 'climb': (66,171,165,171),
    },
    'winter': {
        'hem': (262, 263, 264),
        'side_foot': (65, 261, 103, 279),
        'sleeve': [(91,184),(116,178),(126,193),(126,216),(116,230),(95,231),(89,217)],
        'shoulder': (104,183), 'climb': (74,175,163,175),
    },
}

SCALE = 2
SIZE = 240*SCALE, 310*SCALE
BASELINE = 278

def largest_islands(image, at_least=3):
    alpha = image.getchannel('A')
    width, height = alpha.size
    occupied = bytearray(a >= 108 for a in alpha.getdata())
    regions = []
    for pos, visible in enumerate(occupied):
        if not visible:
            continue
        occupied[pos] = 0
        group = [pos]
        x1, y1, x2, y2 = width, height, 0, 0
        for pt in group:
            x, y = pt%width, pt//width
            x1, y1, x2, y2 = min(x1,x), min(y1,y), max(x2,x), max(y2,y)
            for neighbor in (pt-1 if x else -1, pt+1 if x<width-1 else -1,
                             pt-width if y else -1, pt+width if y<height-1 else -1):
                if neighbor >= 0 and occupied[neighbor]:
                    group.append(neighbor)
                    occupied[neighbor] = 0
        if len(group) > 300:
            regions.append((group, (x1,y1,x2+1,y2+1)))
    if len(regions) < at_least:
        raise ValueError('Expected separated full-body reference views')
    return sorted(regions,key=lambda region:len(region[0]),reverse=True)[:at_least]


def island_image(image, island):
    group, (x0,y0,x1,y1) = island
    padding = 3
    x0,y0=max(0,x0-padding),max(0,y0-padding)
    x1,y1=min(image.width,x1+padding),min(image.height,y1+padding)
    width,height=x1-x0,y1-y0
    mask=bytearray(width*height)
    for pos in group:
        x,y=pos%image.width-x0,pos//image.width-y0
        mask[y*width+x]=255
    matte=Image.frombytes('L',(width,height),bytes(mask)).filter(ImageFilter.MaxFilter(5))
    result=image.crop((x0,y0,x1,y1))
    result.putalpha(ImageChops.multiply(result.getchannel('A'),matte))
    return result.crop(result.getbbox())


def source_views(path):
    image=Image.open(path).convert('RGBA')
    islands=sorted(largest_islands(image),key=lambda item:item[1][0])
    return [island_image(image, view) for view in islands]


def fit(image, canvas, width, height, center, floor):
    scale=min(width/image.width,height/image.height)
    frame=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
    output=Image.new('RGBA',canvas)
    output.alpha_composite(frame,(round(center-frame.width/2),round(floor-frame.height)))
    return output


def register(image, tall):
    return fit(image,SIZE,195*SCALE,tall*SCALE,120*SCALE,BASELINE*SCALE)


def save(image,path,motion=False):
    path.parent.mkdir(parents=True,exist_ok=True)
    image.save(path,'WEBP',lossless=not motion,quality=96,alpha_quality=100,method=5)


def polygon(image, points):
    mask=Image.new('L',image.size)
    ImageDraw.Draw(mask).polygon([(round(x*SCALE),round(y*SCALE)) for x,y in points],fill=255)
    part=image.copy()
    part.putalpha(ImageChops.multiply(image.getchannel('A'),mask))
    return part


def strip_at(image, y):
    torso=image.copy()
    torso.paste((0,0,0,0),(0,round(y*SCALE),image.width,image.height))
    return torso


def transformed(image, origin, target, degrees=0):
    # Inverse transform, so the original embroidered pixels remain the texture.
    a=radians(degrees)
    c,s=cos(a),sin(a)
    ox,oy=(n*SCALE for n in origin)
    tx,ty=(n*SCALE for n in target)
    return image.transform(SIZE,Image.Transform.AFFINE,
        (c,s,ox-c*tx-s*ty,-s,c,oy+s*tx-c*ty),
        Image.Resampling.BICUBIC,fillcolor=(0,0,0,0))


def swing_sleeve(image, shoulder, travel):
    cx, cy=shoulder
    grid=[]
    step=16*SCALE

    def local(px,py):
        x,y=px/SCALE,py/SCALE
        across=max(0,1-abs(x-cx)/40)
        along=max(0,min((y-cy)/40,(267-y)/26,1))
        strength=across**1.7*along
        return (px-travel*strength*SCALE,py+abs(travel)*strength*.16*SCALE)

    for top in range(0,image.height,step):
        bottom=min(top+step,image.height)
        for left in range(0,image.width,step):
            right=min(left+step,image.width)
            corners=local(left,top)+local(left,bottom)+local(right,bottom)+local(right,top)
            grid.append(((left,top,right,bottom),corners))
    return image.transform(image.size,Image.Transform.MESH,grid,Image.Resampling.BICUBIC)


def stack(*parts):
    output=Image.new('RGBA',SIZE)
    for part in parts:
        output.alpha_composite(part)
    return output


def foot(image, box, hem):
    x0,y0,x1,y1=box
    pose=polygon(image,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)])
    anchor=((x0+x1)/2,hem+1)
    return pose,anchor


def atlas(frames):
    output=Image.new('RGBA',(SIZE[0]*len(frames), SIZE[1]))
    for index,frame in enumerate(frames):
        output.alpha_composite(frame,(index*SIZE[0],0))
    return output


def gait(view, pattern, count, running):
    hem=pattern['hem'][1]
    core=strip_at(view,hem)
    shoe,ankle=foot(view,pattern['side_foot'],hem)
    center=(110,192)
    frames=[]
    for index in range(count):
        t=index/count*2*pi
        stride=23 if running else 14
        hops=14 if running else 6
        step=cos(t)
        # Legs alternate between a planted foot and a separate, lifting foot.
        lean=-10 if running else -3
        drop=-abs(sin(t))*hops*.51
        near=transformed(shoe,ankle,(ankle[0]-stride*step+5,ankle[1]-max(0,sin(t))*hops-3),
                         (21 if running else 12)*step)
        far=transformed(shoe,ankle,(ankle[0]+stride*step-3,ankle[1]-max(0,-sin(t))*hops-3),
                        -(23 if running else 14)*step)
        sleeve=swing_sleeve(core,pattern['shoulder'],step*(16 if running else 8))
        actor=stack(far,near,sleeve)
        frames.append(transformed(actor,center,(center[0],center[1]+drop),lean+1.3*sin(t)))
    return frames


def climb(back, side, pattern):
    hem=pattern['hem'][2]
    torso=strip_at(back,hem)
    boot,ankle=foot(side,pattern['side_foot'],pattern['hem'][1])
    near=polygon(side,pattern['sleeve'])
    far=ImageOps.mirror(near)
    sx,sy=pattern['shoulder']
    px,py,qx,qy=pattern['climb']
    frames=[]
    for index in range(18):
        t=index/18*2*pi
        step=cos(t)
        lift=sin(t)
        shoe1=transformed(boot,ankle,(93-3*step,hem-1-7*max(0,lift)),7*lift)
        shoe2=transformed(ImageOps.mirror(boot),(240-ankle[0],ankle[1]),
                         (124-3*step,hem-1-7*max(0,-lift)),-7*lift)
        sleeve1=transformed(near,(sx,sy),(px+2*lift,py-4*step),143-19*step)
        sleeve2=transformed(far,(240-sx,sy),(qx+2*lift,qy+4*step),-143-19*step)
        frames.append(stack(shoe2,shoe1,sleeve1,sleeve2,
                            transformed(torso,(120,190),(120+1.7*lift,190-2.1*abs(lift)),1.5*lift)))
    return frames


def perch(front,pattern):
    hem=pattern['hem'][0]
    core=strip_at(front,hem)
    # The front left and right shoes keep their exact silhouette at release.
    silhouette=front.getchannel('A').crop((0,round(hem*SCALE),SIZE[0],SIZE[1])).getbbox()
    x0,x1=silhouette[0]/SCALE,silhouette[2]/SCALE
    middle=(x0+x1)/2
    a,pa=foot(front,(x0,hem,middle,BASELINE),hem)
    b,pb=foot(front,(middle,hem,x1,BASELINE),hem)
    frames=[]
    for idx in range(8):
        s=sin(idx*pi/4)
        foot1=transformed(a,pa,(pa[0]-1.5,pa[1]-2),5*s)
        foot2=transformed(b,pb,(pb[0]+1.5,pb[1]-2),-5*s)
        actor=stack(foot1,foot2,core)
        frames.append(transformed(actor,(120,248),(120,234),0))
    return frames


def supplement(path,right_path=None):
    image=Image.open(path).convert('RGBA')
    views=largest_islands(image,5)
    top,bottom=sorted(views,key=lambda item:(item[1][1]+item[1][3])*0.5)[:3],sorted(views,key=lambda item:(item[1][1]+item[1][3])*0.5)[3:]
    selected=[island_image(image,item) for item in sorted(top,key=lambda item:item[1][0])+sorted(bottom,key=lambda item:item[1][0])]
    if right_path and right_path.is_file():
        right=Image.open(right_path).convert('RGBA')
        selected[2]=island_image(right,largest_islands(right,1)[0])
    return selected


def turntable(original, extra):
    front,left,back=original
    front_left,front_right,right,back_left,back_right=extra
    ordered=(front,front_left,left,back_left,back,back_right,right,front_right)
    result=Image.new('RGBA',(1024,512))
    for index, art in enumerate(ordered):
        cell=fit(art,(256,256),218,221,128,239)
        result.alpha_composite(cell,(index%4*256,index//4*256))
    return result


def compile_outfit(id, path, angle_path, dest):
    original=source_views(path)
    front,side,back=(register(image,250 if id=='miao' else 240) for image in original)
    folder=dest/id
    def emit(name,image,motion=False):
        save(image,folder/f'{id}-{name}.webp',motion)
    standing=fit(original[0],(1096,1435),1050,1367,548,1403)
    emit('front',standing)
    for direction, art in zip(('front','side','back'),original):
        emit('angle-'+direction,fit(art,(512,512),436,442,256,478))
    emit('turntable',turntable(original,supplement(angle_path,angle_path.with_name(id+'-right.png'))))
    pattern=PATTERNS[id]
    for running,num in [(False,14),(True,8)]:
        name='run' if running else 'walk'
        frames=gait(side,pattern,num,running)
        emit(name+'-left',atlas(frames),True)
        emit(name+'-right',atlas([ImageOps.mirror(frame) for frame in frames]),True)
    emit('climb',atlas(climb(back,side,pattern)),True)
    emit('perch',atlas(perch(front,pattern)),True)
    down=transformed(ImageOps.mirror(side),(121,165),(119,175),40)
    art=down.crop(down.getbbox())
    emit('held',fit(art,(860,639),829,610,432,625))


def main():
    p=ArgumentParser()
    p.add_argument('source',type=Path)
    p.add_argument('angles',type=Path,help='folder with five-view sheets named by outfit id')
    p.add_argument('destination',type=Path)
    p.add_argument('outfits',nargs='*')
    args=p.parse_args()
    for id in args.outfits or REFERENCE:
        compile_outfit(id,args.source/REFERENCE[id],args.angles/(id+'.png'),args.destination)
        print(id,flush=True)


if __name__=='__main__':
    main()
