import type { HonourFormValues, IdolFormValues, KitFormValues, MilestoneFormValues } from './schemas'
import type { HistorySection } from './sections'

// Valores de los formularios de Historia. Módulo sin 'use client': lo leen las páginas del servidor.

export type HistoryFormDefaults =
  | { section: 'hitos'; defaults: MilestoneFormValues }
  | { section: 'titulos'; defaults: HonourFormValues }
  | { section: 'salon-de-la-fama'; defaults: IdolFormValues }
  | { section: 'camisetas'; defaults: KitFormValues }

export const EMPTY_HISTORY_DEFAULTS: { [S in HistorySection]: Extract<HistoryFormDefaults, { section: S }> } =
  {
    hitos: {
      section: 'hitos',
      defaults: { title: '', year: '', month: '', day: '', body: '', imageMediaId: '', isPlaceholder: false },
    },
    titulos: {
      section: 'titulos',
      defaults: { name: '', year: '', seriesId: '', competitionName: '', description: '', imageMediaId: '' },
    },
    'salon-de-la-fama': {
      section: 'salon-de-la-fama',
      defaults: { fullName: '', nickname: '', eraLabel: '', position: '', bio: '', photoMediaId: '' },
    },
    camisetas: {
      section: 'camisetas',
      defaults: { description: '', yearFrom: '', yearTo: '', imageMediaId: '' },
    },
  }
