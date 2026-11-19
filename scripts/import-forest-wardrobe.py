"""Register supplemental Forest Guide views while keeping the supplied front sprite."""
from argparse import ArgumentParser
from pathlib import Path
from runpy import run_path

from PIL import Image

utilities = run_path(str(Path(__file__).with_name('import-fox-reference-wardrobe.py')))
islands = utilities['largest_islands']
extract = utilities['island_image']
fit = utilities['fit']
save = utilities['save']


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('sheet', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    folder = args.destination
    sheet = Image.open(args.sheet).convert('RGBA')
    views = []
    for index in range(8):
        col, row = index % 4, index // 4
        if not index:
            frame = Image.open(folder / 'INFJ_001.png').convert('RGBA')
        else:
            frame = sheet.crop((col * sheet.width // 4, row * sheet.height // 2,
                                (col + 1) * sheet.width // 4, (row + 1) * sheet.height // 2))
        views.append(extract(frame, islands(frame, at_least=1)[0]))

    turntable = Image.new('RGBA', (1024, 512))
    for index, figure in enumerate(views):
        thumb = fit(figure, (256, 256), 204, 221, 128, 238)
        turntable.alpha_composite(thumb, (index % 4 * 256, index // 4 * 256))
    save(turntable, folder / 'turntable.webp')

    for index, kind in [(0,'front'),(1,'front-left'),(2,'side-left'),(4,'back'),(6,'side-right'),(7,'front-right')]:
        save(fit(views[index], (480, 620), 372, 444, 240, 554), folder / (kind + '.webp'))


if __name__ == '__main__':
    main()
