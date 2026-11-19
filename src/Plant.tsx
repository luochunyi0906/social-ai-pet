import type { PlantRecord, PlantVariety } from './types';
import sunflower from './assets/camp/sunflower.png';
import tulip from './assets/camp/tulip.png';
import bluebell from './assets/camp/bluebell.png';
import lavender from './assets/camp/lavender.png';
import strawberry from './assets/camp/strawberry.png';
import lettuce from './assets/camp/lettuce.png';
import carrot from './assets/camp/carrot.png';
import daisy from './assets/camp/daisy.png';
import pumpkin from './assets/camp/pumpkin.png';
import sunflowerSprout from './assets/camp/sprout-sunflower.png';
import tulipSprout from './assets/camp/sprout-tulip.png';
import bluebellSprout from './assets/camp/sprout-bluebell.png';
import lavenderSprout from './assets/camp/sprout-lavender.png';
import strawberrySprout from './assets/camp/sprout-strawberry.png';
import lettuceSprout from './assets/camp/sprout-lettuce.png';
import carrotSprout from './assets/camp/sprout-carrot.png';
import daisySprout from './assets/camp/sprout-daisy.png';
import pumpkinSprout from './assets/camp/sprout-pumpkin.png';

const sprites: Record<PlantVariety, { image: string; sprout: string; width: number; height: number }> = {
  sunflower: { image: sunflower, sprout: sunflowerSprout, width: 59, height: 68 },
  tulip: { image: tulip, sprout: tulipSprout, width: 53, height: 61 },
  bluebell: { image: bluebell, sprout: bluebellSprout, width: 59, height: 60 },
  lavender: { image: lavender, sprout: lavenderSprout, width: 60, height: 54 },
  strawberry: { image: strawberry, sprout: strawberrySprout, width: 61, height: 48 },
  lettuce: { image: lettuce, sprout: lettuceSprout, width: 64, height: 48 },
  carrot: { image: carrot, sprout: carrotSprout, width: 58, height: 56 },
  daisy: { image: daisy, sprout: daisySprout, width: 57, height: 54 },
  pumpkin: { image: pumpkin, sprout: pumpkinSprout, width: 65, height: 49 },
};

export function Plant({ stage, variety }: Pick<PlantRecord, 'stage' | 'variety'>) {
  if (stage === 'planted') {
    return <g className="farm-plant plant-planted" data-plant-variety={variety} aria-hidden="true">
      <ellipse cx="0" cy="-2" rx="9" ry="3.4" fill="#553c27" opacity=".45"/>
      <ellipse cx="0" cy="-4" rx="3.2" ry="1.8" fill="#e4ba70" transform="rotate(-24 0 -4)"/>
    </g>;
  }

  const sprite = sprites[variety];
  const isSprout = stage === 'sprout';
  const scale = stage === 'growing' ? .69 : 1;
  const width = isSprout ? 34 : sprite.width * scale;
  const height = isSprout ? 24 : sprite.height * scale;
  return <g className={`farm-plant plant-${stage}`} data-plant-variety={variety} aria-hidden="true">
    <ellipse cx="0" cy="-1" rx={width * .35} ry={isSprout ? 3 : 5} fill="#322512" opacity=".28"/>
    <image href={isSprout ? sprite.sprout : sprite.image} x={-width / 2} y={-height + 1}
      width={width} height={height} preserveAspectRatio="xMidYMax meet"/>
  </g>;
}
