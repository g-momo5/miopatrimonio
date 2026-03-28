import type {
  Account,
  AccountSnapshot,
  Goal,
  GoalCategory,
  Institution,
  MonthlyCashflowEntry,
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

export interface MonthlyCashflowSummaryRow {
  month: string
  earned: number
  invested: number
  spent: number | null
  saved: number | null
}

interface MonthlyCashflowSummaryOptions {
  currentDate?: string
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

export function buildMonthlyCashflowSummary(
  accounts: Account[],
  snapshots: AccountSnapshot[],
  cashflowEntries: MonthlyCashflowEntry[],
  options: MonthlyCashflowSummaryOptions = {},
): MonthlyCashflowSummaryRow[] {
  const activeBankAccountIds = new Set(
    accounts
      .filter((account) => !account.is_archived && account.account_type === 'bank')
      .map((account) => account.id),
  )

  const bankSnapshots = snapshots.filter((snapshot) =>
    activeBankAccountIds.has(snapshot.account_id),
  )
  const monthSet = new Set<string>()

  for (const snapshot of bankSnapshots) {
    monthSet.add(snapshot.snapshot_date.slice(0, 7))
  }

  for (const entry of cashflowEntries) {
    monthSet.add(entry.entry_date.slice(0, 7))
  }

  const sortedMonths = Array.from(monthSet).sort()
  if (sortedMonths.length === 0) {
    return []
  }

  const firstMonth = sortedMonths[0]
  const lastMonth = sortedMonths[sortedMonths.length - 1]
  const allMonths = buildMonthRange(firstMonth, lastMonth)
  const snapshotDates = Array.from(
    new Set(bankSnapshots.map((snapshot) => snapshot.snapshot_date)),
  ).sort()
  const currentDate = options.currentDate ?? new Date().toISOString().slice(0, 10)
  const currentMonth = currentDate.slice(0, 7)

  const sumsByMonth = new Map<string, { earned: number; invested: number }>()
  for (const entry of cashflowEntries) {
    const month = entry.entry_date.slice(0, 7)
    const current = sumsByMonth.get(month) ?? { earned: 0, invested: 0 }

    if (entry.entry_type === 'income') {
      current.earned += Number(entry.amount_eur)
    } else {
      current.invested += Number(entry.amount_eur)
    }

    sumsByMonth.set(month, current)
  }

  let previousBoundaryDate: string | null = null

  return allMonths.map((month) => {
    const monthSums = sumsByMonth.get(month) ?? { earned: 0, invested: 0 }
    const startDate = resolveMonthStartDate(month, previousBoundaryDate, snapshotDates)
    const resolvedEndDate = resolveMonthBoundaryDate(
      month,
      currentMonth,
      snapshotDates,
    )
    const endDate =
      previousBoundaryDate && resolvedEndDate < previousBoundaryDate
        ? previousBoundaryDate
        : resolvedEndDate
    const bankStart = computeBankBalanceAtDate(bankSnapshots, startDate)
    const bankEnd = computeBankBalanceAtDate(bankSnapshots, endDate)
    const earned = Number(monthSums.earned.toFixed(2))
    const invested = Number(monthSums.invested.toFixed(2))
    const spent = normalizeSignedZero(
      Number((bankStart + earned - invested - bankEnd).toFixed(2)),
    )
    previousBoundaryDate = endDate

    if (spent < 0) {
      return {
        month,
        earned,
        invested,
        spent: null,
        saved: null,
      }
    }

    const saved = normalizeSignedZero(Number((earned - spent - invested).toFixed(2)))

    return {
      month,
      earned,
      invested,
      spent,
      saved,
    }
  })
}

function computeBankBalanceAtDate(
  snapshots: AccountSnapshot[],
  targetDate: string,
): number {
  const latestByAccount = new Map<string, AccountSnapshot>()

  for (const snapshot of snapshots) {
    if (snapshot.snapshot_date > targetDate) {
      continue
    }

    const current = latestByAccount.get(snapshot.account_id)
    if (
      !current ||
      snapshot.snapshot_date > current.snapshot_date ||
      (snapshot.snapshot_date === current.snapshot_date &&
        snapshot.updated_at > current.updated_at)
    ) {
      latestByAccount.set(snapshot.account_id, snapshot)
    }
  }

  let total = 0
  for (const snapshot of latestByAccount.values()) {
    total += Number(snapshot.value_eur)
  }

  return Number(total.toFixed(2))
}

function buildMonthRange(firstMonth: string, lastMonth: string): string[] {
  const result: string[] = []
  const cursor = new Date(`${firstMonth}-01T00:00:00.000Z`)
  const end = new Date(`${lastMonth}-01T00:00:00.000Z`)

  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return result
}

function getMonthEnd(month: string): string {
  const [year, monthValue] = month.split('-').map(Number)
  const monthEnd = new Date(Date.UTC(year, monthValue, 0))
  return monthEnd.toISOString().slice(0, 10)
}

function getPreviousDay(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function resolveMonthBoundaryDate(
  month: string,
  currentMonth: string,
  snapshotDates: string[],
): string {
  if (month === currentMonth) {
    const latestInMonth = findLatestSnapshotDateInMonth(snapshotDates, month)
    if (latestInMonth) {
      return latestInMonth
    }
  }

  const monthEnd = getMonthEnd(month)
  return findClosestSnapshotDate(snapshotDates, monthEnd) ?? monthEnd
}

function resolveMonthStartDate(
  month: string,
  previousBoundaryDate: string | null,
  snapshotDates: string[],
): string {
  const previousMonthEnd = getPreviousDay(`${month}-01`)

  if (snapshotDates.includes(previousMonthEnd)) {
    return previousMonthEnd
  }

  if (previousBoundaryDate) {
    return previousBoundaryDate
  }

  return findClosestSnapshotDate(snapshotDates, previousMonthEnd) ?? previousMonthEnd
}

function findLatestSnapshotDateInMonth(
  snapshotDates: string[],
  month: string,
): string | null {
  for (let index = snapshotDates.length - 1; index >= 0; index -= 1) {
    const snapshotDate = snapshotDates[index]
    if (snapshotDate.slice(0, 7) === month) {
      return snapshotDate
    }
  }

  return null
}

function findClosestSnapshotDate(
  snapshotDates: string[],
  targetDate: string,
): string | null {
  if (snapshotDates.length === 0) {
    return null
  }

  let closestDate = snapshotDates[0]
  let closestDistance = Math.abs(dateDistanceInDays(snapshotDates[0], targetDate))

  for (let index = 1; index < snapshotDates.length; index += 1) {
    const candidateDate = snapshotDates[index]
    const candidateDistance = Math.abs(dateDistanceInDays(candidateDate, targetDate))

    if (
      candidateDistance < closestDistance ||
      (candidateDistance === closestDistance && candidateDate < closestDate)
    ) {
      closestDate = candidateDate
      closestDistance = candidateDistance
    }
  }

  return closestDate
}

function dateDistanceInDays(leftDate: string, rightDate: string): number {
  const left = Date.parse(`${leftDate}T00:00:00.000Z`)
  const right = Date.parse(`${rightDate}T00:00:00.000Z`)
  const millisecondsPerDay = 24 * 60 * 60 * 1000

  return Math.round((left - right) / millisecondsPerDay)
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}
