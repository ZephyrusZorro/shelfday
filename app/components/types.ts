import type { Kitchen } from '../../lib/model';
export type Modal = { type: 'ingredient' | 'receive' | 'recipe' | 'prepare' | 'sell' | 'portionWaste' | 'stockWaste' | 'close' | 'restore' | 'reset' | 'sample' | 'guide'; id?: string; backup?: Kitchen };
export type ViewProps = { state: Kitchen; date: string; open: (modal: Modal) => void; busy: boolean };
