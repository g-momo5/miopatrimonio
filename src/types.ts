export type AccountType = 'bank' | 'investment'

export type InstitutionIcon = 'predefined' | 'custom'

export type InstitutionKind = 'bank' | 'broker' | 'custom'

export type GoalCategory = 'total' | 'bank' | 'investment'
export type CashflowEntryType = 'income' | 'invested'
export type CashflowRecurringOccurrenceStatus = 'pending' | 'confirmed' | 'skipped'

export interface Institution {
  id: string
  user_id: string
  name: string
  kind: InstitutionKind
  icon_mode: InstitutionIcon
  icon_key: string | null
  icon_url: string | null
  logo_scale: number
  logo_offset_x: number
  logo_offset_y: number
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  institution_id: string
  name: string
  account_type: AccountType
  currency: 'EUR'
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface AccountSnapshot {
  id: string
  user_id: string
  account_id: string
  snapshot_date: string
  value_eur: number
  note: string | null
  created_at: string
  updated_at: string
}

export interface InvestmentPosition {
  id: string
  user_id: string
  account_id: string
  name: string
  symbol: string | null
  current_value_eur: number
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  category: GoalCategory
  target_eur: number
  created_at: string
  updated_at: string
}

export interface MonthlyCashflowEntry {
  id: string
  user_id: string
  entry_date: string
  entry_type: CashflowEntryType
  amount_eur: number
  note: string | null
  created_at: string
  updated_at: string
}

export interface CashflowRecurringTemplate {
  id: string
  user_id: string
  name: string
  entry_type: CashflowEntryType
  amount_eur: number
  day_of_month: number
  note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CashflowRecurringOccurrence {
  id: string
  user_id: string
  template_id: string
  month_date: string
  due_date: string
  status: CashflowRecurringOccurrenceStatus
  confirmed_entry_id: string | null
  created_at: string
  updated_at: string
}

export interface SnapshotInput {
  accountId: string
  date: string
  valueEur: number
  note?: string
}

export interface PositionInput {
  accountId: string
  name: string
  symbol?: string
  currentValueEur: number
}

export interface GoalInput {
  category: GoalCategory
  targetEur: number
}

export interface PortfolioDataState {
  institutions: Institution[]
  accounts: Account[]
  snapshots: AccountSnapshot[]
  positions: InvestmentPosition[]
  goals: Goal[]
  cashflowEntries: MonthlyCashflowEntry[]
  recurringTemplates: CashflowRecurringTemplate[]
  recurringOccurrences: CashflowRecurringOccurrence[]
}

export interface BackupPayload {
  version: number
  exportedAt: string
  institutions: Array<{
    name: string
    kind: InstitutionKind
    iconMode: InstitutionIcon
    iconKey: string | null
    iconUrl: string | null
    logoScale: number
    logoOffsetX: number
    logoOffsetY: number
  }>
  accounts: Array<{
    name: string
    accountType: AccountType
    institutionName: string
    isArchived: boolean
    currency: 'EUR'
  }>
  snapshots: Array<{
    accountName: string
    snapshotDate: string
    valueEur: number
    note: string | null
  }>
  positions: Array<{
    accountName: string
    name: string
    symbol: string | null
    currentValueEur: number
  }>
  goals: Array<{
    category: GoalCategory
    targetEur: number
  }>
  cashflowEntries: Array<{
    entryDate: string
    entryType: CashflowEntryType
    amountEur: number
    note: string | null
  }>
  recurringTemplates: Array<{
    name: string
    entryType: CashflowEntryType
    amountEur: number
    dayOfMonth: number
    note: string | null
    isActive: boolean
  }>
  recurringOccurrences: Array<{
    templateName: string
    templateEntryType: CashflowEntryType
    monthDate: string
    dueDate: string
    status: CashflowRecurringOccurrenceStatus
  }>
}
