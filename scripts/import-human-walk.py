"""Register the supplied eight-frame human walk and remove its white matte."""
from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


def cutout(frame):
    rgb = frame.convert('RGB')
    neutral = ImageChops.darker(ImageChops.darker(*rgb.split()[:2]), rgb.getchannel('B'))
    white = neutral.point(lambda x: 255 if x >= 249 else 0)
    # The attached GIF has one white background region open to the border.
    # Flood access preserves the disconnected whites inside shoes, hair and clothes.
    from PIL.ImageDraw import floodfill
    floodfill(white, (0, 0), 128)
    outside = white.point(lambda x: 255 if x == 128 else 0)
    alpha = ImageChops.invert(outside)
    edge = ImageChops.multiply(alpha, outside.filter(ImageFilter.MaxFilter(3)))
    pixels = list(rgb.getdata())
    opacity = list(alpha.getdata())
    for index, exposed in enumerate(edge.getdata()):
        if not exposed:
            continue
        color = pixels[index]
        darkness = 255-min(color)
        if darkness >= 115:
            continue
        opacity[index] = min(255, int(255*(darkness+7)/115))
        pixels[index] = tuple(max(0, int(255+(channel-255)*255/opacity[index])) for channel in color)
    rgb.putdata(pixels)
    result = rgb.convert('RGBA')
    alpha.putdata(opacity)
    result.putalpha(alpha)
    return result


def registered(frames):
    result = []
    bounds = [frame.getchannel('A').point(lambda a:255 if a>170 else 0).getbbox() for frame in frames]
    tall = sorted(box[3]-box[1] for box in bounds)[len(bounds)//2]
    scale = 526/tall
    for art, (left, top, right, bottom) in zip(frames, bounds):
        face = art.getchannel('A').crop((0, top+27, art.width, top+104))
        x1, _, x2, _ = face.point(lambda a:255 if a>170 else 0).getbbox()
        head = (x1+x2)/2
        cell = Image.new('RGBA', (384,576))
        sprite = art.crop((left-1,top-1,right+1,bottom+1))
        sprite = sprite.resize(tuple(round(value*scale) for value in sprite.size),Image.Resampling.LANCZOS)
        cell.alpha_composite(sprite,(round(192-(head-left+1)*scale),round(559-(bottom-top+1)*scale)))
        result.append(cell)
    return result


def main():
    args=ArgumentParser()
    args.add_argument('gif',type=Path)
    args.add_argument('atlas',type=Path)
    args.add_argument('--preview',type=Path)
    args=args.parse_args()
    with Image.open(args.gif) as gif:
        if gif.n_frames!=8:
            raise ValueError('Expected eight walk poses in the supplied GIF')
        poses=[]
        durations=[]
        for index in range(gif.n_frames):
            gif.seek(index)
            poses.append(cutout(gif))
            durations.append(gif.info.get('duration',200))
    frames=registered(poses)
    atlas=Image.new('RGBA',(384*len(frames),576))
    for i, image in enumerate(frames):
        atlas.alpha_composite(image,(384*i,0))
    atlas.save(args.atlas,'WEBP',quality=96,alpha_quality=100)
    if args.preview:
        indexed=[]
        for image in frames:
            item=image.convert('RGB').quantize(colors=255)
            transparent=image.getchannel('A').point(lambda a:255 if a<127 else 0)
            item.paste(255,mask=transparent)
            indexed.append(item)
        indexed[0].save(args.preview,save_all=True,append_images=indexed[1:],duration=durations,
            loop=0,transparency=255,disposal=2,optimize=False)


if __name__=='__main__':
    main()
