import { backupPayloadSchema } from './schemas'
import type { BackupPayload, PortfolioDataState } from '../types'

export function buildBackupPayload(state: PortfolioDataState): BackupPayload {
  const institutionById = new Map(
    state.institutions.map((institution) => [institution.id, institution]),
  )
  const accountById = new Map(state.accounts.map((account) => [account.id, account]))
  const recurringTemplateById = new Map(
    state.recurringTemplates.map((template) => [template.id, template]),
  )

  return {
    version: 3,
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
    cashflowEntries: state.cashflowEntries.map((entry) => ({
      entryDate: entry.entry_date,
      entryType: entry.entry_type,
      amountEur: Number(entry.amount_eur),
      note: entry.note,
    })),
    recurringTemplates: state.recurringTemplates.map((template) => ({
      name: template.name,
      entryType: template.entry_type,
      amountEur: Number(template.amount_eur),
      dayOfMonth: Number(template.day_of_month),
      note: template.note,
      isActive: Boolean(template.is_active),
    })),
    recurringOccurrences: state.recurringOccurrences
      .map((occurrence) => {
        const template = recurringTemplateById.get(occurrence.template_id)
        if (!template) {
          return null
        }

        return {
          templateName: template.name,
          templateEntryType: template.entry_type,
          monthDate: occurrence.month_date,
          dueDate: occurrence.due_date,
          status: occurrence.status,
        }
      })
      .filter(
        (
          occurrence,
        ): occurrence is {
          templateName: string
          templateEntryType: 'income' | 'invested'
          monthDate: string
          dueDate: string
          status: 'pending' | 'confirmed' | 'skipped'
        } => occurrence !== null,
      ),
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
