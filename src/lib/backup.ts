import { backupPayloadSchema } from './schemas'
import type { BackupPayload, PortfolioDataState } from '../types'

export function buildBackupPayload(state: PortfolioDataState): BackupPayload {
  const institutionById = new Map(
    state.institutions.map((institution) => [institution.id, institution]),
  )
  const accountById = new Map(state.accounts.map((account) => [account.id, account]))

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    institutions: state.institutions.map((institution) => ({
      name: institution.name,
      kind: institution.kind,
      iconMode: institution.icon_mode,
      iconKey: institution.icon_key,
      iconUrl: institution.icon_url,
      logoScale: Number(institution.logo_scale),
      logoOffsetX: Number(institution.logo_offset_x),
      logoOffsetY: Number(institution.logo_offset_y),
    })),
    accounts: state.accounts.map((account) => ({
      name: account.name,
      accountType: account.account_type,
      institutionName:
        institutionById.get(account.institution_id)?.name ?? 'Istituto sconosciuto',
      isArchived: account.is_archived,
      currency: 'EUR',
    })),
    snapshots: state.snapshots.map((snapshot) => ({
      accountName: accountById.get(snapshot.account_id)?.name ?? 'Conto sconosciuto',
      snapshotDate: snapshot.snapshot_date,
      valueEur: Number(snapshot.value_eur),
      note: snapshot.note,
    })),
    positions: state.positions.map((position) => ({
      accountName: accountById.get(position.account_id)?.name ?? 'Investimento sconosciuto',
      name: position.name,
      symbol: position.symbol,
      currentValueEur: Number(position.current_value_eur),
    })),
    goals: state.goals.map((goal) => ({
      category: goal.category,
      targetEur: Number(goal.target_eur),
    })),
  }
}

export function parseBackupPayload(raw: unknown): BackupPayload {
  return backupPayloadSchema.parse(raw)
}

export function toSnapshotsCsv(state: PortfolioDataState): string {
  const institutionById = new Map(
    state.institutions.map((institution) => [institution.id, institution]),
  )
  const accountById = new Map(state.accounts.map((account) => [account.id, account]))

  const rows = [
    ['data', 'conto', 'tipo_conto', 'istituto', 'valore_eur', 'nota'].join(','),
  ]

  const sortedSnapshots = [...state.snapshots].sort((left, right) => {
    if (left.snapshot_date === right.snapshot_date) {
      return left.updated_at.localeCompare(right.updated_at)
    }

    return left.snapshot_date.localeCompare(right.snapshot_date)
  })

  for (const snapshot of sortedSnapshots) {
    const account = accountById.get(snapshot.account_id)
    const institution = account
      ? institutionById.get(account.institution_id)
      : undefined

    rows.push(
      [
        snapshot.snapshot_date,
        csvEscape(account?.name ?? ''),
        account?.account_type ?? '',
        csvEscape(institution?.name ?? ''),
        Number(snapshot.value_eur).toFixed(2),
        csvEscape(snapshot.note ?? ''),
      ].join(','),
    )
  }

  return rows.join('\n')
}

function csvEscape(value: string): string {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}

export function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}
