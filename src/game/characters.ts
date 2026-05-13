export type CharacterId = 'baby-brother' | 'little-star' | 'ice-princess' | 'pudding' | 'air-captain';

export type CharacterPreset = {
  id: CharacterId;
  label: string;
  age: string;
  description: string;
  assetKey: string;
  assetUrl: string;
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

const characterAsset = (fileName: string): string => new URL(`../assets/characters/${fileName}`, import.meta.url).href;

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'baby-brother',
    label: '小弟弟',
    age: '半岁',
    description: '穿纸尿裤的萌宝宝',
    assetKey: 'character-baby-brother',
    assetUrl: characterAsset('baby-brother.png'),
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
    age: '幼儿园中班',
    description: '西瓜头和背带裤风格',
    assetKey: 'character-little-star',
    assetUrl: characterAsset('little-star.png'),
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
    age: '小学一年级',
    description: '冰雪裙装的萌版公主',
    assetKey: 'character-ice-princess',
    assetUrl: characterAsset('ice-princess.png'),
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
    age: '小学二年级',
    description: '粉色裙子的甜美女孩',
    assetKey: 'character-pudding',
    assetUrl: characterAsset('pudding.png'),
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
    age: '小学五年级',
    description: '空军制服的学生队长',
    assetKey: 'character-air-captain',
    assetUrl: characterAsset('air-captain.png'),
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
