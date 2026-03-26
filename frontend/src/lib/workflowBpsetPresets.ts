/**
 * 蓝图成品预设：对应 `public/bpset/*.json`，与仓库内 JSON 文件同步维护
 */
const base =
  import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`

export interface WorkflowBpsetPresetMeta {
  id: string
  /** fetch 用 URL */
  url: string
  /** i18n 键：按钮文案 */
  labelKey: string
}

function bpsetUrl(filename: string): string {
  return `${base}bpset/${encodeURIComponent(filename)}`
}

/** 顺序即 UI 按钮顺序（与 public/bpset 下文件一一对应） */
export const WORKFLOW_BPSET_PRESETS: WorkflowBpsetPresetMeta[] = [
  {
    id: 'rpgmakerv1.1x',
    url: bpsetUrl('rpgmakerv1.1x.json'),
    labelKey: 'roninProWorkflowBpset_rpgmakerv1_1x',
  },
  {
    id: 'rpgmakerV3X',
    url: bpsetUrl('rpgmakerV3X.json'),
    labelKey: 'roninProWorkflowBpset_rpgmakerV3X',
  },
  {
    id: 'Dfinal',
    url: bpsetUrl('Dfinal.json'),
    labelKey: 'roninProWorkflowBpset_Dfinal',
  },
  {
    id: 'niaoguai',
    url: bpsetUrl('鸟怪.json'),
    labelKey: 'roninProWorkflowBpset_niaoguai',
  },
  {
    id: 'bafangxiang',
    url: bpsetUrl('八方向.json'),
    labelKey: 'roninProWorkflowBpset_bafangxiang',
  },
  {
    id: 'putongV2_2_2',
    url: bpsetUrl('普通V2&2.2.json'),
    labelKey: 'roninProWorkflowBpset_putongV2_2_2',
  },
  {
    id: 'gou',
    url: bpsetUrl('狗.json'),
    labelKey: 'roninProWorkflowBpset_gou',
  },
  {
    id: 'gongbing',
    url: bpsetUrl('弓兵.json'),
    labelKey: 'roninProWorkflowBpset_gongbing',
  },
]
