import gloves from './assets/camp/gardening-gloves.png';
import { useState } from 'react';
import fox from './assets/companion/act_idle/act_idle_001.png';
import cave from './assets/camp/cave-lit-entrance.png';
import mail from './assets/camp/mail-front-angle.png';
import seed from './assets/camp/seed.png';
import water from './assets/camp/water.png';
import sprout from './assets/camp/sprout.png';
import cabin from './assets/camp/cabin.png';
import bed from './assets/home/bed.png';
import wardrobe from './assets/home/wardrobe.png';
import outfit from './assets/outfits/forest-guide/front.webp';
import notebook from './assets/hot/notebook.webp';

const guides = {
  camp: {
    title: '营地怎么玩',
    steps: [
      [cave, '山洞', '搜知乎、看热榜，收藏喜欢的发现。'],
      [seed, '花园', '从种子箱选种，种到空地上。'],
      [cabin, '暖木小屋', '回家休息、换装，打开床边桌。'],
      [fox, '刘看山', '单击打招呼，双击聊天，或点长凳聊聊。'],
    ],
  },
  feed: {
    title: '信箱怎么用',
    steps: [[mail, '投喂线索', '粘贴文字或选择 TXT、文字型 PDF。也可以点一个样例，勾选授权后开始本地模拟。'],
      [cave, '去找答案', '有关键词就点「直接搜知乎」。投喂后也可从生成的问题继续查找。']],
  },
  cave: {
    title: '山洞怎么玩',
    steps: [[cave, '找内容', '选「主动检索知乎」按词搜索，或打开「今日热榜」看看新话题。']],
  },
  search: {
    title: '怎么搜知乎',
    steps: [[cave, '按关键词找', '输入关键词，勾选确认后开始检索。点结果的来源可看原文，点收藏可以得到种子。']],
  },
  seeds: {
    title: '怎么播种',
    steps: [[seed, '选种子', '先收藏一个发现，再从种子箱选择它。'],
      [sprout, '选空田', '点击空地预览，满意后点「确认播种」。']],
  },
  plot: {
    title: '怎么照料植物',
    steps: [[water, '浇水、施肥', '回到花园底部选浇水或施肥工具，再点要照料的田。'],
      [gloves, '采集种子', '植物开花后，拿起手套点这块田。种子回到种子箱，空田可以重新播种。']],
  },
  journal: {
    title: '手账怎么用',
    steps: [[notebook, '找收藏', '打开原来源，或回到已经播种的田。'],
      [fox, '找学习卡', '切到「你教给我的」，查看、修改或停用学习卡。']],
  },
  chat: {
    title: '怎么和刘看山聊天',
    steps: [[fox, '说说你在想什么', '输入消息开始聊。也可以从知乎结果带一个话题进来。'],
      [notebook, '教看山', '把你的经验整理成学习卡，确认保存后，相关的新对话可以引用。']],
  },
  teaching: {
    title: '怎么教看山',
    steps: [[notebook, '保存学习卡', '用自己的话讲一条经验，检查生成的学习卡，再确认保存。']],
  },
  home: {
    title: '小屋怎么玩',
    steps: [[bed, '休息', '点床入睡，再点一次起床。睡着后可打开床边桌的音乐或闹钟。'],
      [wardrobe, '换装', '点衣柜，预览想穿的衣服。']],
  },
  wardrobe: {
    title: '怎么换装',
    steps: [[outfit, '先试试看', '点一套衣服预览。支持多角度的服装可拖动旋转，满意后再确认穿上。']],
  },
  music: {
    title: '怎么听音乐',
    steps: [[bed, '交给 QQ 音乐播放', '可以打开 QQ 音乐、选本地音频或播放样例，暂停和切歌在客户端操作。']],
  },
  alarm: {
    title: '怎么设闹钟',
    steps: [[bed, '用 Mac 时钟响铃', '按提示导入快捷指令，再选时间创建闹钟。若未收到确认，先到「时钟」检查。']],
  },
  hot: {
    title: '热榜怎么玩',
    steps: [[notebook, '读热点', '点一条热榜看详情，可以打开来源、收藏，或和刘看山聊这条内容。'],
      [fox, '找个问题回答', '切换到「等你来答」浏览知乎问题推荐。']],
  },
  settings: {
    title: '设置里能调些什么',
    steps: [[fox, '桌面活动和天气', '可设置散步范围和天气城市。'],
      [notebook, '在线服务', '可填写服务地址、模型和密钥，保存后由程序直接使用。']],
  },
} satisfies Record<string, { title: string; steps: [string, string, string][] }>;

export function FeatureGuide({ feature, floating = false, openFirst = !floating }: {
  feature: keyof typeof guides;
  floating?: boolean;
  openFirst?: boolean;
}) {
  const guide = guides[feature];
  const key = 'kanshan:illustrated-guide:' + feature;
  const [initialOpen] = useState(() => openFirst && localStorage.getItem(key) !== 'seen');

  return (
    <details className={'feature-guide' + (floating ? ' feature-guide-floating' : '')}
      open={initialOpen} onToggle={event => {
        if (event.currentTarget.open) localStorage.setItem(key, 'seen');
      }}>
      <summary>
        <img src={guide.steps[0][0]} alt=""/>
        <span>{guide.title}</span>
      </summary>
      <ul>
        {guide.steps.map(([picture, title, instruction]) => (
          <li key={title}>
            <img src={picture} alt=""/>
            <div><strong>{title}</strong><p>{instruction}</p></div>
          </li>
        ))}
      </ul>
    </details>
  );
}
