/**
 * 全站 Gemini Pixel Gems 链接；首页「生成大杂烩」与各模块共用。
 * labelKey 对应 `locales.ts` 已有文案键。
 */

export const GEM_RPGMAKER_URL_V1 =
  'https://gemini.google.com/gem/1zkDfsN972fczP66xwCiQ6H0jP7HLtGz5?usp=sharing'
export const GEM_RPGMAKER_URL_V1_1 =
  'https://gemini.google.com/gem/1kUViEEO8ehmIHGNHThI77xpzSXx2KHFb?usp=sharing'
export const GEM_RPGMAKER_URL_V3 =
  'https://gemini.google.com/gem/1b5w2r0-kmMAtMhuGloKxJWuxULoMm177?usp=sharing'
export const GEM_V2_URL = 'https://gemini.google.com/gem/1ex8XOSNJzjAND6Ujz9aKFKbIyqzcvTCv?usp=sharing'
export const GEM_V2_URL_2 = 'https://gemini.google.com/gem/1kEnaydh5Ssne-XxSUQFgVxie93u-kR4P?usp=sharing'
export const GEM_V3_URL = 'https://gemini.google.com/gem/1hAu-pMGYI34Bp_ttYHrRIGljhjbmoFjZ?usp=sharing'
export const GEM_MONSTER_ZOMBIE_B1 =
  'https://gemini.google.com/gem/1AIhSwGHFN1K2wPZwrgnTr7xxM5IwDb3i?usp=sharing'
export const GEM_MONSTER_ZOMBIE_B2 =
  'https://gemini.google.com/gem/1qnjyOOhjMk8k5sW4IXaRDbaxk5yZ63y1?usp=sharing'
export const GEM_CHAR_V23OT_URL =
  'https://gemini.google.com/gem/1mRxvjPRe_jWUxHNB9R7S3aiLiHOTQIU5?usp=sharing'
export const GEM_SCENE_URL = 'https://gemini.google.com/gem/1a83JP082OIliUQZN5SsBguMOrYm4g6P2?usp=sharing'
export const GEM_SCENE_URL_2 = 'https://gemini.google.com/gem/1u2qo4OVCxniX5swJttIS2GuqPjswycmb?usp=sharing'
export const GEM_SCENE_URL_3 = 'https://gemini.google.com/gem/1nrZ7I6KFoPdoF-Ej2kte2edB0Ct-Sb10?usp=sharing'
export const GEM_SCENE_URL_4 = 'https://gemini.google.com/gem/1VuZIChmmyZtWBRdlLnTQREY1gODT4sEJ?usp=sharing' // 街机场景
export const GEM_ILLUST_URL = 'https://gemini.google.com/gem/1IUuJXgHTTbMEgv5D_G0HXSHXxYdcfTZg?usp=sharing'
export const GEM_V4TX3_URL = 'https://gemini.google.com/gem/1zerS4eXHUGNj2tj-63omHyFRo_4K5S7p?usp=sharing'
export const GEM_HORIZONTAL_CHAR_URL =
  'https://gemini.google.com/gem/10LatqlJGxea-I-JCyoNo1rERgZwtKpBi?usp=sharing'
export const GEM_8DIR_TOPDOWN_URL =
  'https://gemini.google.com/gem/1Xr3TdyAOLugE19v5poA4LpJSfVT4Drox?usp=sharing'
export const GEM_HORSE_RIDING_URL =
  'https://gemini.google.com/gem/1n--WxKek4kEZO_gqQeab-u5b3mO-qyl1?usp=sharing'
export const GEM_ONE_IMAGE_ALL_ACTIONS_URL =
  'https://gemini.google.com/gem/1pmNojUIGsB1j5gpEwJIKziyKc-XWM5RP?usp=sharing'
export const GEM_ONE_IMAGE_ALL_ACTIONS_2_URL =
  'https://gemini.google.com/gem/1JV-B4NS1-LQlqXIMrbtM5kq70hxCcCr2?usp=sharing'
export const GEM_PIXEL_DOG_URL =
  'https://gemini.google.com/gem/190hxL7jtTO--9GCNMVvmtYsVZ2H6VBi0?usp=sharing'
export const GEM_PIXEL_BIRD_MONSTER_URL =
  'https://gemini.google.com/gem/1pouwyiLb7tf6A9U6PS1z3S8wnSofDALN?usp=sharing'
export const GEM_PIXEL_JIKUN_URL =
  'https://gemini.google.com/gem/1AQglfk8d8QzYz46oeP5CZzDjyhUK6_dx?usp=sharing'
/** 生成大杂烩 · 吞食天地（S） */
export const GEM_PIXEL_TUNSHITIANDI_S_URL =
  'https://gemini.google.com/gem/1RkRKcu160_S7nAw0XoG3Cj8n_ZgccaPL?usp=sharing'
/** 生成大杂烩 · RPG骑马（潜墨千羽） */
export const GEM_PIXEL_RPG_HORSE_QIANMO_URL =
  'https://gemini.google.com/gem/901be39a347f?usp=sharing'
/** 生成大杂烩 · RPGold（s） */
export const GEM_PIXEL_RPGOLD_S_URL =
  'https://gemini.google.com/gem/1XeOiyNUE7oGZBn9rk4Xlk4fEzDGwIbAL?usp=sharing'

export interface GemPixelPotpourriItem {
  url: string
  labelKey: string
  /** 相对 `public/` 的预览图路径，如 `gempic/吞食天地.png` */
  previewPublicPath?: string
}

/** 生成大杂烩子页 9 格：`null` 为预留位 */
export const GEM_PIXEL_POTPOURRI_HUB_SLOTS: (GemPixelPotpourriItem | null)[] = [
  {
    url: GEM_PIXEL_TUNSHITIANDI_S_URL,
    labelKey: 'gemPixelPotpourriTunshiTiandiS',
    previewPublicPath: 'gempic/吞食天地.png',
  },
  {
    url: GEM_PIXEL_RPG_HORSE_QIANMO_URL,
    labelKey: 'gemPixelPotpourriRpgHorseQianmo',
    previewPublicPath: 'gempic/riderrpg.png',
  },
  {
    url: GEM_PIXEL_RPGOLD_S_URL,
    labelKey: 'gemPixelPotpourriRpgoldS',
    previewPublicPath: 'gempic/rpgold.png',
  },
  null,
  null,
  null,
  null,
  null,
  null,
]

/** 首页「生成大杂烩」按钮顺序；每行 3 个由 UI grid 控制 */
export const GEM_PIXEL_POTPOURRI: GemPixelPotpourriItem[] = [
  { url: GEM_RPGMAKER_URL_V1, labelKey: 'moduleNanobananaRpgmakerGemV1' },
  { url: GEM_RPGMAKER_URL_V1_1, labelKey: 'moduleNanobananaRpgmakerGemV1_1' },
  { url: GEM_RPGMAKER_URL_V3, labelKey: 'moduleNanobananaRpgmakerGemV3' },
  { url: GEM_V2_URL, labelKey: 'gemV2Link1' },
  { url: GEM_V2_URL_2, labelKey: 'gemV2Link2' },
  { url: GEM_V3_URL, labelKey: 'gemV2Link3' },
  { url: GEM_MONSTER_ZOMBIE_B1, labelKey: 'moduleGemMonsterZombieB1' },
  { url: GEM_MONSTER_ZOMBIE_B2, labelKey: 'moduleGemMonsterZombieB2' },
  { url: GEM_CHAR_V23OT_URL, labelKey: 'moduleCharGenV23OT' },
  { url: GEM_SCENE_URL, labelKey: 'nanobananaSceneLink1' },
  { url: GEM_SCENE_URL_2, labelKey: 'nanobananaSceneLink2' },
  { url: GEM_SCENE_URL_3, labelKey: 'nanobananaSceneLink3' },
  { url: GEM_SCENE_URL_4, labelKey: 'nanobananaSceneLink4' },
  { url: GEM_ILLUST_URL, labelKey: 'moduleIllust' },
  { url: GEM_V4TX3_URL, labelKey: 'nanobananaFullCharBtn1' },
  { url: GEM_HORIZONTAL_CHAR_URL, labelKey: 'nanobananaFullCharBtn2' },
  { url: GEM_8DIR_TOPDOWN_URL, labelKey: 'nanobananaFullCharBtn3' },
  { url: GEM_HORSE_RIDING_URL, labelKey: 'nanobananaFullCharBtn4' },
  { url: GEM_ONE_IMAGE_ALL_ACTIONS_URL, labelKey: 'nanobananaFullCharBtn5' },
  { url: GEM_ONE_IMAGE_ALL_ACTIONS_2_URL, labelKey: 'nanobananaFullCharBtn6' },
  { url: GEM_PIXEL_DOG_URL, labelKey: 'aiPixelAnimalsGemDog' },
  { url: GEM_PIXEL_BIRD_MONSTER_URL, labelKey: 'aiPixelAnimalsGemBirdMonster' },
  { url: GEM_PIXEL_JIKUN_URL, labelKey: 'aiPixelAnimalsGemJikun' },
]
