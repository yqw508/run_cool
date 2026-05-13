export type CharacterId = 'baby-brother' | 'little-star' | 'ice-princess' | 'pudding' | 'air-captain';

export type CharacterPreset = {
  id: CharacterId;
  label: string;
  age: string;
  description: string;
  skinColor: number;
  hairColor: number;
  outfitColor: number;
  accentColor: number;
  detailColor: number;
  style: 'aviatorBaby' | 'overalls' | 'iceDress' | 'pinkDress' | 'airUniform';
};

export type CharacterSelection = {
  presetId: CharacterId;
};

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'baby-brother',
    label: '小弟弟',
    age: '半岁',
    description: '纸尿裤宝宝',
    skinColor: 0xffc9a3,
    hairColor: 0x5c3a28,
    outfitColor: 0xe8f5ec,
    accentColor: 0x9aa7a0,
    detailColor: 0x2d3135,
    style: 'aviatorBaby'
  },
  {
    id: 'little-star',
    label: '小星星',
    age: '中班',
    description: '西瓜头背带裤',
    skinColor: 0xffc39a,
    hairColor: 0x2d211b,
    outfitColor: 0x31a7ff,
    accentColor: 0xffd447,
    detailColor: 0xffffff,
    style: 'overalls'
  },
  {
    id: 'ice-princess',
    label: '冰雪小公主',
    age: '一年级',
    description: '蓝白雪花裙',
    skinColor: 0xffd4b2,
    hairColor: 0xf8f3d6,
    outfitColor: 0x8ed8ff,
    accentColor: 0xffffff,
    detailColor: 0x73c7ff,
    style: 'iceDress'
  },
  {
    id: 'pudding',
    label: '小布丁',
    age: '二年级',
    description: '粉色小裙子',
    skinColor: 0xffc5a0,
    hairColor: 0x5b3426,
    outfitColor: 0xff87b7,
    accentColor: 0xffd1e1,
    detailColor: 0xffd447,
    style: 'pinkDress'
  },
  {
    id: 'air-captain',
    label: '空军上尉',
    age: '五年级',
    description: '空军制服',
    skinColor: 0xf4b88d,
    hairColor: 0x27364a,
    outfitColor: 0x597ba8,
    accentColor: 0xd9ecff,
    detailColor: 0xffd447,
    style: 'airUniform'
  }
];

export const DEFAULT_SELECTION: CharacterSelection = {
  presetId: CHARACTER_PRESETS[0].id
};

export function resolveSelection(selection: CharacterSelection): CharacterPreset {
  return CHARACTER_PRESETS.find((item) => item.id === selection.presetId) ?? CHARACTER_PRESETS[0];
}
