import { describe, expect, it } from 'vitest'
import {
  buildTrendSeries,
  computeGoalProgress,
  computeNetWorth,
} from './calculations'
import type { Account, AccountSnapshot, Goal, Institution } from '../types'

const institutions: Institution[] = [
  {
    id: 'i1',
    user_id: 'u1',
    name: 'Intesa Sanpaolo',
    kind: 'bank',
    icon_mode: 'predefined',
    icon_key: 'intesa-sanpaolo',
    icon_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'i2',
    user_id: 'u1',
    name: 'Trade Republic',
    kind: 'broker',
    icon_mode: 'predefined',
    icon_key: 'trade-republic',
    icon_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

const accounts: Account[] = [
  {
    id: 'a-bank',
    user_id: 'u1',
    institution_id: 'i1',
    name: 'Conto principale',
    account_type: 'bank',
    currency: 'EUR',
    is_archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a-invest',
    user_id: 'u1',
    institution_id: 'i2',
    name: 'Broker ETF',
    account_type: 'investment',
    currency: 'EUR',
    is_archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

const snapshots: AccountSnapshot[] = [
  {
    id: 's1',
    user_id: 'u1',
    account_id: 'a-bank',
    snapshot_date: '2026-01-10',
    value_eur: 1000,
    note: null,
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 's2',
    user_id: 'u1',
    account_id: 'a-invest',
    snapshot_date: '2026-01-11',
    value_eur: 500,
    note: null,
    created_at: '2026-01-11T08:00:00.000Z',
    updated_at: '2026-01-11T08:00:00.000Z',
  },
  {
    id: 's3',
    user_id: 'u1',
    account_id: 'a-bank',
    snapshot_date: '2026-01-12',
    value_eur: 1200,
    note: null,
    created_at: '2026-01-12T08:00:00.000Z',
    updated_at: '2026-01-12T08:00:00.000Z',
  },
]

describe('computeNetWorth', () => {
  it('calcola totale e subtotali usando gli ultimi snapshot', () => {
    const summary = computeNetWorth(accounts, snapshots, institutions)

    expect(summary.total).toBe(1700)
    expect(summary.bank).toBe(1200)
    expect(summary.investment).toBe(500)
    expect(summary.byInstitution).toEqual([
      {
        institutionId: 'i1',
        institutionName: 'Intesa Sanpaolo',
        value: 1200,
      },
      {
        institutionId: 'i2',
        institutionName: 'Trade Republic',
        value: 500,
      },
    ])
  })
})

describe('buildTrendSeries', () => {
  it('ordina e aggrega la serie storica', () => {
    const trend = buildTrendSeries(accounts, snapshots)

    expect(trend).toEqual([
      { date: '2026-01-10', total: 1000, bank: 1000, investment: 0 },
      { date: '2026-01-11', total: 1500, bank: 1000, investment: 500 },
      { date: '2026-01-12', total: 1700, bank: 1200, investment: 500 },
    ])
  })
})

describe('computeGoalProgress', () => {
  it('gestisce target a zero senza divisioni invalide', () => {
    const goals: Goal[] = [
      {
        id: 'g1',
        user_id: 'u1',
        category: 'total',
        target_eur: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]

    const result = computeGoalProgress(goals, {
      total: 1500,
      bank: 1000,
      investment: 500,
    })

    expect(result[0].progress).toBe(0)
    expect(result[0].remaining).toBe(0)
  })
})
