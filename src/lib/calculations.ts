import type {
  Account,
  AccountSnapshot,
  Goal,
  GoalCategory,
  Institution,
} from '../types'

export interface NetWorthSummary {
  total: number
  bank: number
  investment: number
  byInstitution: Array<{
    institutionId: string
    institutionName: string
    value: number
  }>
}

export interface TrendPoint {
  date: string
  total: number
  bank: number
  investment: number
}

export interface GoalProgress {
  goal: Goal
  current: number
  progress: number
  remaining: number
}

export function buildLatestSnapshotMap(
  snapshots: AccountSnapshot[],
): Map<string, AccountSnapshot> {
  const latest = new Map<string, AccountSnapshot>()

  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.account_id)

    if (
      !current ||
      snapshot.snapshot_date > current.snapshot_date ||
      (snapshot.snapshot_date === current.snapshot_date &&
        snapshot.updated_at > current.updated_at)
    ) {
      latest.set(snapshot.account_id, snapshot)
    }
  }

  return latest
}

export function computeNetWorth(
  accounts: Account[],
  snapshots: AccountSnapshot[],
  institutions: Institution[],
): NetWorthSummary {
  const latest = buildLatestSnapshotMap(snapshots)
  const institutionNameById = new Map(
    institutions.map((institution) => [institution.id, institution.name]),
  )
  const byInstitutionMap = new Map<string, number>()

  let total = 0
  let bank = 0
  let investment = 0

  for (const account of accounts) {
    if (account.is_archived) {
      continue
    }

    const snapshot = latest.get(account.id)
    if (!snapshot) {
      continue
    }

    const value = Number(snapshot.value_eur)
    total += value

    if (account.account_type === 'bank') {
      bank += value
    } else {
      investment += value
    }

    const current = byInstitutionMap.get(account.institution_id) ?? 0
    byInstitutionMap.set(account.institution_id, current + value)
  }

  const byInstitution = Array.from(byInstitutionMap.entries())
    .map(([institutionId, value]) => ({
      institutionId,
      institutionName:
        institutionNameById.get(institutionId) ?? 'Istituto sconosciuto',
      value,
    }))
    .sort((left, right) => right.value - left.value)

  return {
    total,
    bank,
    investment,
    byInstitution,
  }
}

export function buildTrendSeries(
  accounts: Account[],
  snapshots: AccountSnapshot[],
): TrendPoint[] {
  const activeAccountIds = new Set(
    accounts.filter((account) => !account.is_archived).map((account) => account.id),
  )

  const accountTypeById = new Map(
    accounts.map((account) => [account.id, account.account_type]),
  )

  const orderedSnapshots = snapshots
    .filter((snapshot) => activeAccountIds.has(snapshot.account_id))
    .sort((left, right) => {
      if (left.snapshot_date === right.snapshot_date) {
        return left.updated_at.localeCompare(right.updated_at)
      }

      return left.snapshot_date.localeCompare(right.snapshot_date)
    })

  const currentValues = new Map<string, number>()
  const pointsByDate = new Map<string, TrendPoint>()

  for (const snapshot of orderedSnapshots) {
    currentValues.set(snapshot.account_id, Number(snapshot.value_eur))

    let total = 0
    let bank = 0
    let investment = 0

    for (const [accountId, value] of currentValues.entries()) {
      total += value

      if (accountTypeById.get(accountId) === 'bank') {
        bank += value
      } else {
        investment += value
      }
    }

    pointsByDate.set(snapshot.snapshot_date, {
      date: snapshot.snapshot_date,
      total,
      bank,
      investment,
    })
  }

  return Array.from(pointsByDate.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  )
}

export function computeGoalProgress(
  goals: Goal[],
  totals: Pick<NetWorthSummary, 'total' | 'bank' | 'investment'>,
): GoalProgress[] {
  const categoryValues: Record<GoalCategory, number> = {
    total: totals.total,
    bank: totals.bank,
    investment: totals.investment,
  }

  return goals
    .map((goal) => {
      const target = Number(goal.target_eur)
      const current = categoryValues[goal.category] ?? 0
      const progress = target <= 0 ? 0 : Math.min((current / target) * 100, 999)

      return {
        goal,
        current,
        progress,
        remaining: Math.max(target - current, 0),
      }
    })
    .sort((left, right) => left.goal.category.localeCompare(right.goal.category))
}
