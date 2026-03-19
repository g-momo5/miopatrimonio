import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  Archive,
  House,
  Pencil,
  RotateCcw,
  Settings,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { AuthScreen } from './components/AuthScreen'
import { InstitutionAvatar } from './components/InstitutionAvatar'
import { PortfolioCharts } from './components/PortfolioCharts'
import {
  getPresetInstitutionByKey,
  PRESET_INSTITUTIONS,
} from './constants/presetInstitutions'
import {
  buildLatestSnapshotMap,
  buildTrendSeries,
  computeGoalProgress,
  computeNetWorth,
} from './lib/calculations'
import { buildBackupPayload, downloadFile, toSnapshotsCsv } from './lib/backup'
import { formatCurrency, formatDate } from './lib/format'
import { resolveInstitutionLogoCandidates } from './lib/institutionLogos'
import { useAuth } from './hooks/useAuth'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { usePortfolioData } from './hooks/usePortfolioData'
import type {
  AccountSnapshot,
  GoalCategory,
  Institution,
  InstitutionKind,
  InvestmentPosition,
} from './types'
import './App.css'

interface Feedback {
  kind: 'success' | 'error'
  message: string
}

type WorkspacePage = 'dashboard' | 'accounts' | 'investments' | 'settings'

const TODAY = new Date().toISOString().slice(0, 10)
const CHART_FALLBACK_COLORS = [
  '#0f766e',
  '#2563eb',
  '#f59e0b',
  '#9333ea',
  '#db2777',
  '#dc2626',
  '#0ea5e9',
  '#16a34a',
  '#a16207',
  '#4f46e5',
]
const DEFAULT_LOGO_SCALE = 1
const DEFAULT_LOGO_OFFSET = 0
const NEW_CUSTOM_CHOICE = 'new-custom'
const NEW_CUSTOM_EDITOR_TARGET = 'editor:new-custom'
const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Impossibile leggere il file'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

function pickFallbackColor(label: string): string {
  const hash = Array.from(label).reduce(
    (accumulator, char) => accumulator + char.charCodeAt(0),
    0,
  )

  return CHART_FALLBACK_COLORS[hash % CHART_FALLBACK_COLORS.length]
}

function normalizeInstitutionName(name: string): string {
  return name.trim().toLocaleLowerCase('it-IT')
}

function presetChoice(presetKey: string): string {
  return `preset:${presetKey}`
}

function customChoice(institutionId: string): string {
  return `custom:${institutionId}`
}

function isPresetChoice(choice: string): boolean {
  return choice.startsWith('preset:')
}

function isCustomChoice(choice: string): boolean {
  return choice.startsWith('custom:')
}

function getPresetKeyFromChoice(choice: string): string | null {
  if (!isPresetChoice(choice)) {
    return null
  }

  return choice.slice('preset:'.length)
}

function getInstitutionIdFromChoice(choice: string): string | null {
  if (!isCustomChoice(choice)) {
    return null
  }

  return choice.slice('custom:'.length)
}

interface EditorTarget {
  key: string
  institutionId: string | null
  presetKey: string | null
  defaultName: string
  kind: InstitutionKind
  institution: Pick<
    Institution,
    | 'name'
    | 'kind'
    | 'icon_mode'
    | 'icon_key'
    | 'icon_url'
    | 'logo_scale'
    | 'logo_offset_x'
    | 'logo_offset_y'
  >
}

function App() {
  const isOnline = useOnlineStatus()
  const { session, loading, error, isConfigured, signIn, signOut, signUp } = useAuth()

  if (!isConfigured) {
    return <SupabaseSetupScreen />
  }

  if (loading) {
    return <LoadingScreen label="Caricamento sessione..." />
  }

  if (!session) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <PortfolioWorkspace
      userId={session.user.id}
      isOnline={isOnline}
      authError={error}
      onSignOut={signOut}
    />
  )
}

interface PortfolioWorkspaceProps {
  userId: string
  isOnline: boolean
  authError: string | null
  onSignOut: () => Promise<void>
}

function PortfolioWorkspace({
  userId,
  isOnline,
  authError,
  onSignOut,
}: PortfolioWorkspaceProps) {
  const {
    data,
    loading,
    error,
    offlineReadOnly,
    refresh,
    createInstitution,
    updateInstitution,
    upsertPresetInstitutionOverride,
    createAccount,
    updateAccount,
    toggleArchiveAccount,
    addOrUpdateSnapshot,
    deleteSnapshot,
    addOrUpdatePosition,
    deletePosition,
    addOrUpdateGoal,
    deleteGoal,
    importBackup,
  } = usePortfolioData(userId, isOnline)

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [activePage, setActivePage] = useState<WorkspacePage>('dashboard')

  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<'bank' | 'investment'>('bank')
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [accountInitialBalance, setAccountInitialBalance] = useState('')
  const [accountInstitutionChoice, setAccountInstitutionChoice] = useState(
    presetChoice(PRESET_INSTITUTIONS[0].key),
  )
  const [showAccountInstitutionChooser, setShowAccountInstitutionChooser] =
    useState(false)
  const [accountCustomInstitutionName, setAccountCustomInstitutionName] = useState('')
  const [accountCustomInstitutionLogoUrl, setAccountCustomInstitutionLogoUrl] = useState('')

  const [editorTargetKey, setEditorTargetKey] = useState(
    presetChoice(PRESET_INSTITUTIONS[0].key),
  )
  const [editorName, setEditorName] = useState(PRESET_INSTITUTIONS[0].name)
  const [editorLogoUrl, setEditorLogoUrl] = useState('')
  const [editorScale, setEditorScale] = useState(String(DEFAULT_LOGO_SCALE))
  const [editorOffsetX, setEditorOffsetX] = useState(String(DEFAULT_LOGO_OFFSET))
  const [editorOffsetY, setEditorOffsetY] = useState(String(DEFAULT_LOGO_OFFSET))

  const [snapshotEditingId, setSnapshotEditingId] = useState<string | undefined>()
  const [snapshotAccountId, setSnapshotAccountId] = useState('')
  const [snapshotDate, setSnapshotDate] = useState(TODAY)
  const [snapshotValue, setSnapshotValue] = useState('')
  const [snapshotNote, setSnapshotNote] = useState('')

  const [positionEditingId, setPositionEditingId] = useState<string | undefined>()
  const [positionAccountId, setPositionAccountId] = useState('')
  const [positionName, setPositionName] = useState('')
  const [positionSymbol, setPositionSymbol] = useState('')
  const [positionValue, setPositionValue] = useState('')

  const [goalCategory, setGoalCategory] = useState<GoalCategory>('total')
  const [goalTarget, setGoalTarget] = useState('')

  const institutionById = useMemo(
    () => new Map(data.institutions.map((institution) => [institution.id, institution])),
    [data.institutions],
  )

  const presetOverrideByKey = useMemo(() => {
    const map = new Map<string, Institution>()

    for (const institution of data.institutions) {
      if (institution.icon_key && !map.has(institution.icon_key)) {
        map.set(institution.icon_key, institution)
      }
    }

    return map
  }, [data.institutions])

  const customInstitutions = useMemo(
    () =>
      data.institutions
        .filter((institution) => !institution.icon_key)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [data.institutions],
  )

  const presetChooserItems = useMemo(
    () =>
      PRESET_INSTITUTIONS.map((preset) => {
        const override = presetOverrideByKey.get(preset.key)
        const institutionForAvatar: Pick<
          Institution,
          | 'name'
          | 'icon_key'
          | 'icon_mode'
          | 'icon_url'
          | 'logo_scale'
          | 'logo_offset_x'
          | 'logo_offset_y'
          | 'user_id'
          | 'id'
          | 'kind'
          | 'created_at'
        > =
          override ??
          {
            id: `preset-${preset.key}`,
            user_id: userId,
            name: preset.name,
            kind: preset.kind,
            icon_key: preset.key,
            icon_mode: 'predefined',
            icon_url: null,
            logo_scale: DEFAULT_LOGO_SCALE,
            logo_offset_x: DEFAULT_LOGO_OFFSET,
            logo_offset_y: DEFAULT_LOGO_OFFSET,
            created_at: '',
          }

        return {
          choice: presetChoice(preset.key),
          preset,
          override,
          name: override?.name ?? preset.name,
          institutionForAvatar,
        }
      }),
    [presetOverrideByKey, userId],
  )

  const editorTargets = useMemo<EditorTarget[]>(
    () => [
      ...PRESET_INSTITUTIONS.map((preset) => {
        const override = presetOverrideByKey.get(preset.key)
        return {
          key: presetChoice(preset.key),
          institutionId: override?.id ?? null,
          presetKey: preset.key,
          defaultName: preset.name,
          kind: preset.kind,
          institution: {
            name: override?.name ?? preset.name,
            kind: preset.kind,
            icon_mode: override?.icon_mode ?? 'predefined',
            icon_key: preset.key,
            icon_url: override?.icon_url ?? null,
            logo_scale: override?.logo_scale ?? DEFAULT_LOGO_SCALE,
            logo_offset_x: override?.logo_offset_x ?? DEFAULT_LOGO_OFFSET,
            logo_offset_y: override?.logo_offset_y ?? DEFAULT_LOGO_OFFSET,
          },
        }
      }),
      ...customInstitutions.map((institution) => ({
        key: customChoice(institution.id),
        institutionId: institution.id,
        presetKey: null,
        defaultName: institution.name,
        kind: institution.kind,
        institution: {
          name: institution.name,
          kind: institution.kind,
          icon_mode: institution.icon_mode,
          icon_key: null,
          icon_url: institution.icon_url,
          logo_scale: institution.logo_scale,
          logo_offset_x: institution.logo_offset_x,
          logo_offset_y: institution.logo_offset_y,
        },
      })),
    ],
    [customInstitutions, presetOverrideByKey],
  )

  const editorTarget = useMemo(
    () => {
      if (editorTargetKey === NEW_CUSTOM_EDITOR_TARGET) {
        return null
      }

      return (
        editorTargets.find((target) => target.key === editorTargetKey) ??
        editorTargets[0] ??
        null
      )
    },
    [editorTargetKey, editorTargets],
  )

  const isNewCustomEditor = editorTargetKey === NEW_CUSTOM_EDITOR_TARGET

  const accountById = useMemo(
    () => new Map(data.accounts.map((account) => [account.id, account])),
    [data.accounts],
  )

  const activeAccounts = useMemo(
    () => data.accounts.filter((account) => !account.is_archived),
    [data.accounts],
  )

  const investmentAccounts = useMemo(
    () => activeAccounts.filter((account) => account.account_type === 'investment'),
    [activeAccounts],
  )

  const accountPageType: 'bank' | 'investment' | null =
    activePage === 'accounts'
      ? 'bank'
      : activePage === 'investments'
        ? 'investment'
        : null

  const accountPageAccounts = useMemo(
    () =>
      accountPageType
        ? data.accounts.filter((account) => account.account_type === accountPageType)
        : [],
    [accountPageType, data.accounts],
  )

  const accountPageActiveAccounts = useMemo(
    () =>
      accountPageType
        ? activeAccounts.filter((account) => account.account_type === accountPageType)
        : [],
    [accountPageType, activeAccounts],
  )

  const latestSnapshotMap = useMemo(
    () => buildLatestSnapshotMap(data.snapshots),
    [data.snapshots],
  )

  const summary = useMemo(
    () => computeNetWorth(data.accounts, data.snapshots, data.institutions),
    [data.accounts, data.snapshots, data.institutions],
  )

  const trendData = useMemo(
    () => buildTrendSeries(data.accounts, data.snapshots),
    [data.accounts, data.snapshots],
  )

  const allocationData = useMemo(
    () => [
      { name: 'Conti', value: summary.bank },
      { name: 'Investimenti', value: summary.investment },
    ],
    [summary.bank, summary.investment],
  )

  const institutionData = useMemo(
    () =>
      summary.byInstitution.map((item) => {
        const institution = institutionById.get(item.institutionId)
        const presetFromKey = getPresetInstitutionByKey(institution?.icon_key)
        const presetFromName = PRESET_INSTITUTIONS.find(
          (preset) =>
            normalizeInstitutionName(preset.name) ===
            normalizeInstitutionName(item.institutionName),
        )
        const color =
          presetFromKey?.primaryColor ??
          presetFromName?.primaryColor ??
          pickFallbackColor(item.institutionName)

        return {
          name: item.institutionName,
          value: item.value,
          color,
        }
      }),
    [institutionById, summary.byInstitution],
  )

  const goalsProgress = useMemo(
    () =>
      computeGoalProgress(data.goals, {
        total: summary.total,
        bank: summary.bank,
        investment: summary.investment,
      }),
    [data.goals, summary.total, summary.bank, summary.investment],
  )

  const goalTargets = useMemo(
    () =>
      data.goals.reduce<Partial<Record<GoalCategory, number>>>((accumulator, goal) => {
        const target = Number(goal.target_eur)
        if (Number.isFinite(target) && target > 0) {
          accumulator[goal.category] = target
        }
        return accumulator
      }, {}),
    [data.goals],
  )

  const sortedSnapshots = useMemo(
    () =>
      [...data.snapshots].sort((left, right) => {
        if (left.snapshot_date === right.snapshot_date) {
          return right.updated_at.localeCompare(left.updated_at)
        }

        return right.snapshot_date.localeCompare(left.snapshot_date)
      }),
    [data.snapshots],
  )

  const accountPageSnapshots = useMemo(
    () =>
      sortedSnapshots.filter((snapshot) => {
        if (!accountPageType) {
          return true
        }

        const account = accountById.get(snapshot.account_id)
        return account?.account_type === accountPageType
      }),
    [accountById, accountPageType, sortedSnapshots],
  )

  const investmentAccountIdSet = useMemo(
    () => new Set(investmentAccounts.map((account) => account.id)),
    [investmentAccounts],
  )

  const visibleInvestmentPositions = useMemo(
    () =>
      data.positions.filter((position) => investmentAccountIdSet.has(position.account_id)),
    [data.positions, investmentAccountIdSet],
  )

  function selectEditorTarget(target: EditorTarget): void {
    setEditorTargetKey(target.key)
    setEditorName(target.institution.name)
    setEditorLogoUrl(target.institution.icon_url ?? '')
    setEditorScale(String(target.institution.logo_scale ?? DEFAULT_LOGO_SCALE))
    setEditorOffsetX(String(target.institution.logo_offset_x ?? DEFAULT_LOGO_OFFSET))
    setEditorOffsetY(String(target.institution.logo_offset_y ?? DEFAULT_LOGO_OFFSET))
  }

  function startNewCustomInstitutionEditor(): void {
    setEditorTargetKey(NEW_CUSTOM_EDITOR_TARGET)
    setEditorName('')
    setEditorLogoUrl('')
    setEditorScale(String(DEFAULT_LOGO_SCALE))
    setEditorOffsetX(String(DEFAULT_LOGO_OFFSET))
    setEditorOffsetY(String(DEFAULT_LOGO_OFFSET))
  }

  const selectedAccountInstitution = useMemo(() => {
    if (accountInstitutionChoice === NEW_CUSTOM_CHOICE) {
      return null
    }

    const presetKey = getPresetKeyFromChoice(accountInstitutionChoice)
    if (presetKey) {
      return presetChooserItems.find((item) => item.preset.key === presetKey) ?? null
    }

    const customInstitutionId = getInstitutionIdFromChoice(accountInstitutionChoice)
    if (!customInstitutionId) {
      return null
    }

    const institution = institutionById.get(customInstitutionId)
    if (!institution) {
      return null
    }

    return {
      choice: customChoice(institution.id),
      preset: null,
      override: institution,
      name: institution.name,
      institutionForAvatar: institution,
    }
  }, [accountInstitutionChoice, institutionById, presetChooserItems])

  async function runAction<T>(
    action: () => Promise<T>,
    successMessage: string,
  ): Promise<void> {
    setFeedback(null)

    try {
      await action()
      setFeedback({ kind: 'success', message: successMessage })
    } catch (actionError) {
      setFeedback({
        kind: 'error',
        message:
          actionError instanceof Error
            ? actionError.message
            : 'Operazione non riuscita',
      })
    }
  }

  async function handleSaveInstitutionEditor(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    const successMessage = isNewCustomEditor
      ? 'Istituto personalizzato creato'
      : 'Istituto aggiornato'

    await runAction(async () => {
      const normalizedName = editorName.trim()
      if (!normalizedName) {
        throw new Error('Inserisci il nome istituto')
      }

      const parsedScale = Number(editorScale)
      const parsedOffsetX = Number(editorOffsetX)
      const parsedOffsetY = Number(editorOffsetY)

      if (
        !Number.isFinite(parsedScale) ||
        !Number.isFinite(parsedOffsetX) ||
        !Number.isFinite(parsedOffsetY)
      ) {
        throw new Error('Valori logo non validi')
      }

      const logoUrl = editorLogoUrl.trim()
      const iconMode = logoUrl ? 'custom' : 'predefined'

      if (isNewCustomEditor) {
        const createdInstitutionId = await createInstitution({
          name: normalizedName,
          kind: 'custom',
          iconMode,
          iconKey: null,
          iconUrl: logoUrl || null,
          logoScale: parsedScale,
          logoOffsetX: parsedOffsetX,
          logoOffsetY: parsedOffsetY,
        })
        setEditorTargetKey(customChoice(createdInstitutionId))
        return
      }

      if (!editorTarget) {
        throw new Error('Nessun istituto selezionato')
      }

      if (editorTarget.presetKey) {
        await upsertPresetInstitutionOverride({
          presetKey: editorTarget.presetKey,
          defaultName: editorTarget.defaultName,
          defaultKind: editorTarget.kind,
          name: normalizedName,
          iconMode,
          iconUrl: logoUrl || null,
          logoScale: parsedScale,
          logoOffsetX: parsedOffsetX,
          logoOffsetY: parsedOffsetY,
        })
        return
      }

      if (!editorTarget.institutionId) {
        throw new Error('Istituto non valido')
      }

      await updateInstitution({
        institutionId: editorTarget.institutionId,
        name: normalizedName,
        kind: editorTarget.kind,
        iconMode,
        iconKey: null,
        iconUrl: logoUrl || null,
        logoScale: parsedScale,
        logoOffsetX: parsedOffsetX,
        logoOffsetY: parsedOffsetY,
      })
    }, successMessage)
  }

  function handleResetEditorPreset(): void {
    if (!editorTarget?.presetKey) {
      return
    }

    setEditorName(editorTarget.defaultName)
    setEditorLogoUrl('')
    setEditorScale(String(DEFAULT_LOGO_SCALE))
    setEditorOffsetX(String(DEFAULT_LOGO_OFFSET))
    setEditorOffsetY(String(DEFAULT_LOGO_OFFSET))
  }

  async function handleAddAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await runAction(async () => {
      const name = accountName.trim()

      if (!name) {
        throw new Error('Inserisci il nome del conto')
      }

      let institutionInput: {
        name: string
        kind: InstitutionKind
        iconMode: 'predefined' | 'custom'
        iconKey: string | null
        iconUrl: string | null
        logoScale: number
        logoOffsetX: number
        logoOffsetY: number
      }

      if (accountInstitutionChoice === NEW_CUSTOM_CHOICE) {
        if (!accountCustomInstitutionName.trim()) {
          throw new Error('Inserisci il nome dell’istituto personalizzato')
        }

        institutionInput = {
          name: accountCustomInstitutionName.trim(),
          kind: accountType === 'investment' ? 'broker' : 'bank',
          iconMode: accountCustomInstitutionLogoUrl.trim() ? 'custom' : 'predefined',
          iconKey: null,
          iconUrl: accountCustomInstitutionLogoUrl.trim() || null,
          logoScale: DEFAULT_LOGO_SCALE,
          logoOffsetX: DEFAULT_LOGO_OFFSET,
          logoOffsetY: DEFAULT_LOGO_OFFSET,
        }
      } else {
        const selectedPresetKey = getPresetKeyFromChoice(accountInstitutionChoice)

        if (selectedPresetKey) {
          const selectedPresetItem = presetChooserItems.find(
            (presetItem) => presetItem.preset.key === selectedPresetKey,
          )

          if (!selectedPresetItem) {
            throw new Error('Istituto predefinito non valido')
          }

          institutionInput = {
            name: selectedPresetItem.name,
            kind: selectedPresetItem.preset.kind,
            iconMode: selectedPresetItem.override?.icon_mode ?? 'predefined',
            iconKey: selectedPresetItem.preset.key,
            iconUrl: selectedPresetItem.override?.icon_url ?? null,
            logoScale:
              selectedPresetItem.override?.logo_scale ?? DEFAULT_LOGO_SCALE,
            logoOffsetX:
              selectedPresetItem.override?.logo_offset_x ?? DEFAULT_LOGO_OFFSET,
            logoOffsetY:
              selectedPresetItem.override?.logo_offset_y ?? DEFAULT_LOGO_OFFSET,
          }
        } else {
          const selectedCustomId = getInstitutionIdFromChoice(accountInstitutionChoice)
          const selectedCustomInstitution = selectedCustomId
            ? institutionById.get(selectedCustomId)
            : null

          if (!selectedCustomInstitution) {
            throw new Error('Istituto personalizzato non valido')
          }

          institutionInput = {
            name: selectedCustomInstitution.name,
            kind: selectedCustomInstitution.kind,
            iconMode: selectedCustomInstitution.icon_mode,
            iconKey: selectedCustomInstitution.icon_key,
            iconUrl: selectedCustomInstitution.icon_url,
            logoScale: selectedCustomInstitution.logo_scale,
            logoOffsetX: selectedCustomInstitution.logo_offset_x,
            logoOffsetY: selectedCustomInstitution.logo_offset_y,
          }
        }
      }

      if (editingAccountId) {
        await updateAccount({
          accountId: editingAccountId,
          name,
          accountType,
          institution: institutionInput,
        })
      } else {
        const parsedInitialBalance = Number(accountInitialBalance)

        if (!Number.isFinite(parsedInitialBalance) || parsedInitialBalance < 0) {
          throw new Error('Inserisci il saldo iniziale valido')
        }

        await createAccount({
          name,
          accountType,
          initialBalanceEur: parsedInitialBalance,
          institution: institutionInput,
        })
      }

      resetAccountForm()
    }, editingAccountId ? 'Conto aggiornato' : 'Conto creato')
  }

  function beginAccountEdit(accountId: string): void {
    const account = accountById.get(accountId)
    if (!account) {
      return
    }

    const institution = institutionById.get(account.institution_id)
    if (!institution) {
      return
    }

    setEditingAccountId(account.id)
    setAccountName(account.name)
    setAccountType(account.account_type)
    setShowAccountInstitutionChooser(false)
    setAccountCustomInstitutionName('')
    setAccountCustomInstitutionLogoUrl('')

    if (institution.icon_key && getPresetInstitutionByKey(institution.icon_key)) {
      setAccountInstitutionChoice(presetChoice(institution.icon_key))
      return
    }

    if (!institution.icon_key) {
      setAccountInstitutionChoice(customChoice(institution.id))
      return
    }

    setAccountInstitutionChoice(NEW_CUSTOM_CHOICE)
    setAccountCustomInstitutionName(institution.name)
    setAccountCustomInstitutionLogoUrl(institution.icon_url ?? '')
  }

  function resetAccountForm(): void {
    setEditingAccountId(null)
    setAccountName('')
    setAccountType(accountPageType ?? 'bank')
    setAccountInitialBalance('')
    setAccountInstitutionChoice(presetChoice(PRESET_INSTITUTIONS[0].key))
    setAccountCustomInstitutionName('')
    setAccountCustomInstitutionLogoUrl('')
    setShowAccountInstitutionChooser(false)
  }

  function switchPage(nextPage: WorkspacePage): void {
    setActivePage(nextPage)

    if (nextPage === 'accounts') {
      setAccountType('bank')
      setEditingAccountId(null)
      setShowAccountInstitutionChooser(false)
      setAccountName('')
      setAccountInitialBalance('')
      setAccountInstitutionChoice(presetChoice(PRESET_INSTITUTIONS[0].key))
      setAccountCustomInstitutionName('')
      setAccountCustomInstitutionLogoUrl('')
      resetSnapshotForm()
      resetPositionForm()
      return
    }

    if (nextPage === 'investments') {
      setAccountType('investment')
      setEditingAccountId(null)
      setShowAccountInstitutionChooser(false)
      setAccountName('')
      setAccountInitialBalance('')
      setAccountInstitutionChoice(presetChoice(PRESET_INSTITUTIONS[0].key))
      setAccountCustomInstitutionName('')
      setAccountCustomInstitutionLogoUrl('')
      resetSnapshotForm()
      resetPositionForm()
      return
    }

    setShowAccountInstitutionChooser(false)
    resetSnapshotForm()
    resetPositionForm()
  }

  async function handleSubmitSnapshot(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await runAction(async () => {
      const parsedValue = Number(snapshotValue)

      if (!snapshotAccountId) {
        throw new Error('Seleziona il conto da aggiornare')
      }

      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        throw new Error('Inserisci un valore valido in EUR')
      }

      await addOrUpdateSnapshot({
        snapshotId: snapshotEditingId,
        accountId: snapshotAccountId,
        date: snapshotDate,
        valueEur: parsedValue,
        note: snapshotNote,
      })

      resetSnapshotForm()
    }, snapshotEditingId ? 'Snapshot modificato' : 'Snapshot salvato')
  }

  function beginSnapshotEdit(snapshot: AccountSnapshot): void {
    setSnapshotEditingId(snapshot.id)
    setSnapshotAccountId(snapshot.account_id)
    setSnapshotDate(snapshot.snapshot_date)
    setSnapshotValue(String(snapshot.value_eur))
    setSnapshotNote(snapshot.note ?? '')
  }

  function resetSnapshotForm(): void {
    setSnapshotEditingId(undefined)
    setSnapshotAccountId('')
    setSnapshotDate(TODAY)
    setSnapshotValue('')
    setSnapshotNote('')
  }

  async function handleSubmitPosition(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await runAction(async () => {
      const parsedValue = Number(positionValue)

      if (!positionAccountId) {
        throw new Error('Seleziona il conto investimento')
      }

      if (!positionName.trim()) {
        throw new Error('Inserisci il nome posizione')
      }

      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        throw new Error('Inserisci un valore posizione valido')
      }

      await addOrUpdatePosition({
        positionId: positionEditingId,
        accountId: positionAccountId,
        name: positionName,
        symbol: positionSymbol,
        currentValueEur: parsedValue,
      })

      resetPositionForm()
    }, positionEditingId ? 'Posizione aggiornata' : 'Posizione inserita')
  }

  function beginPositionEdit(position: InvestmentPosition): void {
    setPositionEditingId(position.id)
    setPositionAccountId(position.account_id)
    setPositionName(position.name)
    setPositionSymbol(position.symbol ?? '')
    setPositionValue(String(position.current_value_eur))
  }

  function resetPositionForm(): void {
    setPositionEditingId(undefined)
    setPositionAccountId('')
    setPositionName('')
    setPositionSymbol('')
    setPositionValue('')
  }

  async function handleSubmitGoal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await runAction(async () => {
      const parsedTarget = Number(goalTarget)
      if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
        throw new Error('Inserisci un target valido')
      }

      await addOrUpdateGoal({
        category: goalCategory,
        targetEur: parsedTarget,
      })

      setGoalTarget('')
    }, 'Obiettivo salvato')
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    await runAction(async () => {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as unknown
      await importBackup(parsed)
    }, 'Backup importato con successo')
  }

  async function handleExportJson(): Promise<void> {
    await runAction(async () => {
      const payload = buildBackupPayload(data)
      downloadFile(
        JSON.stringify(payload, null, 2),
        `mio-patrimonio-backup-${TODAY}.json`,
        'application/json',
      )
    }, 'Backup JSON esportato')
  }

  async function handleExportCsv(): Promise<void> {
    await runAction(async () => {
      const csv = toSnapshotsCsv(data)
      downloadFile(csv, `mio-patrimonio-snapshots-${TODAY}.csv`, 'text/csv;charset=utf-8')
    }, 'CSV esportato')
  }

  async function handleLogoFileInput(
    event: ChangeEvent<HTMLInputElement>,
    onLoaded: (dataUrl: string) => void,
  ): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setFeedback({
        kind: 'error',
        message: 'Seleziona un file immagine valido',
      })
      return
    }

    if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
      setFeedback({
        kind: 'error',
        message: 'Il file logo deve essere massimo 2 MB',
      })
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      onLoaded(dataUrl)
    } catch {
      setFeedback({
        kind: 'error',
        message: 'Errore durante il caricamento del file logo',
      })
    }
  }

  const editorPreviewScale = Number.isFinite(Number(editorScale))
    ? Number(editorScale)
    : DEFAULT_LOGO_SCALE
  const editorPreviewOffsetX = Number.isFinite(Number(editorOffsetX))
    ? Number(editorOffsetX)
    : DEFAULT_LOGO_OFFSET
  const editorPreviewOffsetY = Number.isFinite(Number(editorOffsetY))
    ? Number(editorOffsetY)
    : DEFAULT_LOGO_OFFSET
  const editorPreviewIconMode: Institution['icon_mode'] = editorLogoUrl.trim()
    ? 'custom'
    : 'predefined'
  const editorPreviewName =
    editorName.trim() || editorTarget?.defaultName || 'Nuovo istituto'
  const editorPreviewInstitution = {
    name: editorPreviewName,
    icon_key: editorTarget?.presetKey ?? null,
    icon_mode: editorPreviewIconMode,
    icon_url: editorLogoUrl.trim() || null,
  }

  if (loading) {
    return <LoadingScreen label="Caricamento patrimonio..." />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Mio Patrimonio</h1>
          <p className="muted">Monitor conti correnti e investimenti in EUR</p>
        </div>
        <div className="actions-row">
          <span className={`status-dot ${offlineReadOnly ? 'offline' : 'online'}`}>
            {offlineReadOnly ? 'Offline' : 'Online'}
          </span>
          <button type="button" className="secondary" onClick={() => void refresh()}>
            Aggiorna
          </button>
          <button type="button" className="secondary" onClick={() => void onSignOut()}>
            Esci
          </button>
        </div>
      </header>

      <nav className="page-nav">
        <button
          type="button"
          className={activePage === 'dashboard' ? 'active' : ''}
          onClick={() => switchPage('dashboard')}
          title="Dashboard"
          aria-label="Dashboard"
        >
          <House className="page-nav-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={activePage === 'accounts' ? 'active' : ''}
          onClick={() => switchPage('accounts')}
          title="Conti"
          aria-label="Conti"
        >
          <Wallet className="page-nav-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={activePage === 'investments' ? 'active' : ''}
          onClick={() => switchPage('investments')}
          title="Investimenti"
          aria-label="Investimenti"
        >
          <TrendingUp className="page-nav-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={activePage === 'settings' ? 'active' : ''}
          onClick={() => switchPage('settings')}
          title="Impostazioni"
          aria-label="Impostazioni"
        >
          <Settings className="page-nav-icon" aria-hidden="true" />
        </button>
      </nav>

      {offlineReadOnly ? (
        <div className="banner warning">
          Sei offline: puoi consultare i dati cache, ma non modificare record.
        </div>
      ) : null}

      {authError ? <div className="banner error">{authError}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}
      {feedback ? <div className={`banner ${feedback.kind}`}>{feedback.message}</div> : null}

      {activePage === 'dashboard' ? (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <span>Patrimonio totale</span>
              <strong>{formatCurrency(summary.total)}</strong>
            </article>
            <article className="kpi-card">
              <span>Subtotale conti</span>
              <strong>{formatCurrency(summary.bank)}</strong>
            </article>
            <article className="kpi-card">
              <span>Subtotale investimenti</span>
              <strong>{formatCurrency(summary.investment)}</strong>
            </article>
          </section>

          <PortfolioCharts
            trendData={trendData}
            allocationData={allocationData}
            institutionData={institutionData}
            goalTargets={goalTargets}
          />
        </>
      ) : null}

      <section
        className={`grid forms-grid ${
          activePage === 'dashboard' ? '' : 'forms-grid-stacked'
        }`}
      >
        {activePage === 'settings' ? (
          <>
            <article className="panel">
              <h2>Modifica istituti</h2>
              <p className="muted">
                Modifica nome, logo e inquadratura per preset e istituti personalizzati.
              </p>
              <div className="stack">
                <p className="muted">
                  Seleziona l’istituto da modificare oppure usa + per crearne uno personalizzato.
                </p>
                <div className="institution-picker-grid">
                  {editorTargets.map((target) => (
                    <button
                      key={target.key}
                      type="button"
                      className={`institution-tile ${
                        editorTarget?.key === target.key ? 'active' : ''
                      }`}
                      onClick={() => selectEditorTarget(target)}
                      title={target.institution.name}
                    >
                      <InstitutionAvatar
                        name={target.institution.name}
                        iconCandidates={resolveInstitutionLogoCandidates(target.institution)}
                        logoScale={target.institution.logo_scale}
                        logoOffsetX={target.institution.logo_offset_x}
                        logoOffsetY={target.institution.logo_offset_y}
                        size={40}
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`institution-tile institution-tile-plus ${
                      isNewCustomEditor ? 'active' : ''
                    }`}
                    title="Nuovo istituto personalizzato"
                    onClick={startNewCustomInstitutionEditor}
                  >
                    +
                  </button>
                </div>
              </div>

              <form className="stack" onSubmit={handleSaveInstitutionEditor}>
                <label className="stack">
                  Nome istituto
                  <input
                    type="text"
                    value={editorName}
                    onChange={(event) => setEditorName(event.target.value)}
                    placeholder="Es. Intesa Sanpaolo"
                  />
                </label>

                <label className="stack">
                  URL logo custom (opzionale)
                  <input
                    type="url"
                    value={editorLogoUrl}
                    onChange={(event) => setEditorLogoUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>

                <label className="stack">
                  Carica logo da file (opzionale)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void handleLogoFileInput(event, (dataUrl) => setEditorLogoUrl(dataUrl))
                    }
                  />
                </label>

                <label className="stack">
                  Zoom logo ({editorScale})
                  <input
                    type="range"
                    min="0.6"
                    max="2.4"
                    step="0.05"
                    value={editorScale}
                    onChange={(event) => setEditorScale(event.target.value)}
                  />
                </label>

                <label className="stack">
                  Offset X ({editorOffsetX}px)
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={editorOffsetX}
                    onChange={(event) => setEditorOffsetX(event.target.value)}
                  />
                </label>

                <label className="stack">
                  Offset Y ({editorOffsetY}px)
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={editorOffsetY}
                    onChange={(event) => setEditorOffsetY(event.target.value)}
                  />
                </label>

                <div className="institution-editor-preview">
                  {editorPreviewInstitution ? (
                    <InstitutionAvatar
                      name={editorPreviewInstitution.name}
                      iconCandidates={resolveInstitutionLogoCandidates(
                        editorPreviewInstitution,
                      )}
                      logoScale={editorPreviewScale}
                      logoOffsetX={editorPreviewOffsetX}
                      logoOffsetY={editorPreviewOffsetY}
                      size={56}
                    />
                  ) : null}
                  <p className="muted">
                    Anteprima logo nel cerchio. Se il logo custom fallisce, resta il
                    fallback.
                  </p>
                </div>

                <div className="actions-row">
                  <button type="submit" disabled={offlineReadOnly}>
                    {isNewCustomEditor ? 'Crea istituto' : 'Salva istituto'}
                  </button>
                  {editorTarget?.presetKey ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={offlineReadOnly}
                      onClick={handleResetEditorPreset}
                    >
                      Reset preset
                    </button>
                  ) : null}
                </div>
              </form>
            </article>

            <article className="panel">
              <h2>Obiettivi</h2>
              <form className="stack" onSubmit={handleSubmitGoal}>
                <label className="stack">
                  Categoria
                  <select
                    value={goalCategory}
                    onChange={(event) => setGoalCategory(event.target.value as GoalCategory)}
                  >
                    <option value="total">Totale patrimonio</option>
                    <option value="bank">Solo conti</option>
                    <option value="investment">Solo investimenti</option>
                  </select>
                </label>

                <label className="stack">
                  Target EUR
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goalTarget}
                    onChange={(event) => setGoalTarget(event.target.value)}
                  />
                </label>

                <button type="submit" disabled={offlineReadOnly}>
                  Salva obiettivo
                </button>
              </form>

              <div className="goals-list">
                {goalsProgress.map((goalProgress) => (
                  <div className="goal-item" key={goalProgress.goal.id}>
                    <div className="inline spread">
                      <strong>{goalLabel(goalProgress.goal.category)}</strong>
                      <button
                        type="button"
                        className="ghost danger"
                        disabled={offlineReadOnly}
                        onClick={() =>
                          void runAction(
                            () => deleteGoal(goalProgress.goal.id),
                            'Obiettivo eliminato',
                          )
                        }
                      >
                        Elimina
                      </button>
                    </div>
                    <p className="muted">
                      {formatCurrency(goalProgress.current)} /{' '}
                      {formatCurrency(Number(goalProgress.goal.target_eur))}
                    </p>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(goalProgress.progress, 100)}%` }}
                      />
                    </div>
                    <p className="muted">
                      Avanzamento {goalProgress.progress.toFixed(1)}% · Mancano{' '}
                      {formatCurrency(goalProgress.remaining)}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <h2>Backup e import</h2>
              <p className="muted">
                Backup completo JSON per ripristino. CSV per analisi rapida.
              </p>

              <div className="stack">
                <button type="button" onClick={() => void handleExportJson()}>
                  Export JSON
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void handleExportCsv()}
                >
                  Export CSV snapshot
                </button>
                <label className="file-input">
                  Import JSON
                  <input
                    type="file"
                    accept="application/json"
                    onChange={(event) => void handleImportBackup(event)}
                    disabled={offlineReadOnly}
                  />
                </label>
              </div>
            </article>
          </>
        ) : null}

        {activePage === 'accounts' || activePage === 'investments' ? (
          <>
            <article className="panel">
              <h2>{activePage === 'accounts' ? 'Conti correnti' : 'Investimenti'}</h2>
              <p className="muted">
                Tipo conto selezionato: {activePage === 'accounts' ? 'Conto corrente' : 'Investimento'}
              </p>
              <form className="stack" onSubmit={handleAddAccount}>
                <label className="stack">
                  Nome conto
                  <input
                    type="text"
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    placeholder={
                      activePage === 'accounts' ? 'Es. Conto principale' : 'Es. Broker principale'
                    }
                  />
                </label>

                {editingAccountId ? null : (
                  <label className="stack">
                    Saldo iniziale EUR
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={accountInitialBalance}
                      onChange={(event) => setAccountInitialBalance(event.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </label>
                )}

                <div className="stack">
                  <label>Istituto</label>
                  <button
                    type="button"
                    className="institution-trigger"
                    onClick={() => setShowAccountInstitutionChooser((current) => !current)}
                  >
                    {selectedAccountInstitution ? (
                      <>
                        <InstitutionAvatar
                          name={selectedAccountInstitution.name}
                          iconCandidates={resolveInstitutionLogoCandidates(
                            selectedAccountInstitution.institutionForAvatar,
                          )}
                          logoScale={selectedAccountInstitution.institutionForAvatar.logo_scale}
                          logoOffsetX={
                            selectedAccountInstitution.institutionForAvatar.logo_offset_x
                          }
                          logoOffsetY={
                            selectedAccountInstitution.institutionForAvatar.logo_offset_y
                          }
                          size={32}
                        />
                        <span>{selectedAccountInstitution.name}</span>
                      </>
                    ) : (
                      <span>Istituto personalizzato</span>
                    )}
                  </button>

                  {showAccountInstitutionChooser ? (
                    <>
                      <div className="institution-picker-grid">
                        {presetChooserItems.map((item) => (
                          <button
                            key={item.choice}
                            type="button"
                            className={`institution-tile ${
                              accountInstitutionChoice === item.choice ? 'active' : ''
                            }`}
                            title={item.name}
                            onClick={() => {
                              setAccountInstitutionChoice(item.choice)
                              setShowAccountInstitutionChooser(false)
                            }}
                          >
                            <InstitutionAvatar
                              name={item.name}
                              iconCandidates={resolveInstitutionLogoCandidates(
                                item.institutionForAvatar,
                              )}
                              logoScale={item.institutionForAvatar.logo_scale}
                              logoOffsetX={item.institutionForAvatar.logo_offset_x}
                              logoOffsetY={item.institutionForAvatar.logo_offset_y}
                              size={40}
                            />
                          </button>
                        ))}

                        {customInstitutions.map((institution) => {
                          const choice = customChoice(institution.id)
                          return (
                            <button
                              key={institution.id}
                              type="button"
                              className={`institution-tile ${
                                accountInstitutionChoice === choice ? 'active' : ''
                              }`}
                              title={institution.name}
                              onClick={() => {
                                setAccountInstitutionChoice(choice)
                                setShowAccountInstitutionChooser(false)
                              }}
                            >
                              <InstitutionAvatar
                                name={institution.name}
                                iconCandidates={resolveInstitutionLogoCandidates(institution)}
                                logoScale={institution.logo_scale}
                                logoOffsetX={institution.logo_offset_x}
                                logoOffsetY={institution.logo_offset_y}
                                size={40}
                              />
                            </button>
                          )
                        })}

                        <button
                          type="button"
                          className={`institution-tile institution-tile-plus ${
                            accountInstitutionChoice === NEW_CUSTOM_CHOICE ? 'active' : ''
                          }`}
                          title="Nuovo istituto personalizzato"
                          onClick={() => {
                            setAccountInstitutionChoice(NEW_CUSTOM_CHOICE)
                            setShowAccountInstitutionChooser(false)
                          }}
                        >
                          +
                        </button>
                      </div>
                      <p className="muted">
                        Scegli il logo istituto o usa + per creare un istituto personalizzato.
                      </p>
                    </>
                  ) : null}
                </div>

                {accountInstitutionChoice === NEW_CUSTOM_CHOICE ? (
                  <>
                    <label className="stack">
                      Nome istituto personalizzato
                      <input
                        type="text"
                        value={accountCustomInstitutionName}
                        onChange={(event) =>
                          setAccountCustomInstitutionName(event.target.value)
                        }
                        placeholder="Es. Banca locale"
                      />
                    </label>
                    <label className="stack">
                      URL logo (opzionale)
                      <input
                        type="url"
                        value={accountCustomInstitutionLogoUrl}
                        onChange={(event) =>
                          setAccountCustomInstitutionLogoUrl(event.target.value)
                        }
                        placeholder="https://..."
                      />
                    </label>
                    <label className="stack">
                      Carica logo da file (opzionale)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          void handleLogoFileInput(event, (dataUrl) =>
                            setAccountCustomInstitutionLogoUrl(dataUrl),
                          )
                        }
                      />
                    </label>
                  </>
                ) : null}

                <div className="actions-row">
                  <button type="submit" disabled={offlineReadOnly}>
                    {editingAccountId ? 'Salva modifica' : 'Crea conto'}
                  </button>
                  {editingAccountId ? (
                    <button type="button" className="secondary" onClick={resetAccountForm}>
                      Annulla
                    </button>
                  ) : null}
                </div>
              </form>
            </article>

            <article className="panel panel-wide">
              <h2>
                {activePage === 'accounts' ? 'Elenco conti aperti' : 'Elenco investimenti'}
              </h2>
              <div className="list">
                {accountPageAccounts.map((account) => {
                  const institution = institutionById.get(account.institution_id)
                  const latestSnapshot = latestSnapshotMap.get(account.id)

                  return (
                    <div className="list-row spread" key={account.id}>
                      <div className="inline">
                        <InstitutionAvatar
                          name={institution?.name ?? 'Istituto'}
                          iconCandidates={
                            institution ? resolveInstitutionLogoCandidates(institution) : undefined
                          }
                          logoScale={institution?.logo_scale}
                          logoOffsetX={institution?.logo_offset_x}
                          logoOffsetY={institution?.logo_offset_y}
                        />
                        <div>
                          <strong>{account.name}</strong>
                          <p className="muted">
                            {account.account_type === 'bank' ? 'Conto' : 'Investimento'} ·{' '}
                            {institution?.name ?? 'Istituto sconosciuto'}
                          </p>
                          <p className="amount-line">
                            Ultimo saldo:{' '}
                            {latestSnapshot ? formatCurrency(Number(latestSnapshot.value_eur)) : 'N/D'}
                          </p>
                        </div>
                      </div>

                      <div className="inline-actions">
                        <button
                          type="button"
                          className="ghost icon-button"
                          disabled={offlineReadOnly}
                          onClick={() => beginAccountEdit(account.id)}
                          title={`Modifica ${account.name}`}
                          aria-label={`Modifica ${account.name}`}
                        >
                          <Pencil className="action-icon" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="ghost icon-button"
                          disabled={offlineReadOnly}
                          onClick={() =>
                            void runAction(
                              () => toggleArchiveAccount(account.id, !account.is_archived),
                              account.is_archived ? 'Conto riattivato' : 'Conto archiviato',
                            )
                          }
                          title={account.is_archived ? `Riattiva ${account.name}` : `Archivia ${account.name}`}
                          aria-label={account.is_archived ? `Riattiva ${account.name}` : `Archivia ${account.name}`}
                        >
                          {account.is_archived ? (
                            <RotateCcw className="action-icon" aria-hidden="true" />
                          ) : (
                            <Archive className="action-icon" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
                {accountPageAccounts.length === 0 ? (
                  <p className="muted">
                    Nessun {activePage === 'accounts' ? 'conto corrente' : 'investimento'} presente.
                  </p>
                ) : null}
              </div>
            </article>

            <article className="panel panel-wide">
              <h2>{activePage === 'accounts' ? 'Snapshot conti' : 'Snapshot investimenti'}</h2>
              <form className="grid form-grid" onSubmit={handleSubmitSnapshot}>
                <label className="stack">
                  Conto
                  <select
                    value={snapshotAccountId}
                    onChange={(event) => setSnapshotAccountId(event.target.value)}
                  >
                    <option value="">Seleziona...</option>
                    {accountPageActiveAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="stack">
                  Data
                  <input
                    type="date"
                    value={snapshotDate}
                    onChange={(event) => setSnapshotDate(event.target.value)}
                  />
                </label>

                <label className="stack">
                  Valore EUR
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={snapshotValue}
                    onChange={(event) => setSnapshotValue(event.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <label className="stack">
                  Nota opzionale
                  <input
                    type="text"
                    value={snapshotNote}
                    onChange={(event) => setSnapshotNote(event.target.value)}
                    placeholder="Es. stipendio, ribilanciamento"
                  />
                </label>

                <div className="actions-row">
                  <button type="submit" disabled={offlineReadOnly}>
                    {snapshotEditingId ? 'Salva modifica' : 'Aggiungi snapshot'}
                  </button>
                  {snapshotEditingId ? (
                    <button type="button" className="secondary" onClick={resetSnapshotForm}>
                      Annulla
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Conto</th>
                      <th>Valore</th>
                      <th>Nota</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountPageSnapshots.map((snapshot) => {
                      const account = accountById.get(snapshot.account_id)
                      return (
                        <tr key={snapshot.id}>
                          <td>{formatDate(snapshot.snapshot_date)}</td>
                          <td>{account?.name ?? 'Conto rimosso'}</td>
                          <td>{formatCurrency(Number(snapshot.value_eur))}</td>
                          <td>{snapshot.note ?? '-'}</td>
                          <td>
                            <div className="inline-actions">
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => beginSnapshotEdit(snapshot)}
                              >
                                Modifica
                              </button>
                              <button
                                type="button"
                                className="ghost danger"
                                disabled={offlineReadOnly}
                                onClick={() =>
                                  void runAction(
                                    () => deleteSnapshot(snapshot.id),
                                    'Snapshot eliminato',
                                  )
                                }
                              >
                                Elimina
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {accountPageSnapshots.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Nessuno snapshot disponibile.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        ) : null}

        {activePage === 'investments' ? (
          <article className="panel panel-wide">
            <h2>Posizioni investimento</h2>
            <p className="muted">Valore attuale manuale per ogni posizione</p>
            <form className="grid form-grid" onSubmit={handleSubmitPosition}>
              <label className="stack">
                Conto investimento
                <select
                  value={positionAccountId}
                  onChange={(event) => setPositionAccountId(event.target.value)}
                >
                  <option value="">Seleziona...</option>
                  {investmentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="stack">
                Nome posizione
                <input
                  type="text"
                  value={positionName}
                  onChange={(event) => setPositionName(event.target.value)}
                  placeholder="Es. ETF MSCI World"
                />
              </label>

              <label className="stack">
                Simbolo (opz.)
                <input
                  type="text"
                  value={positionSymbol}
                  onChange={(event) => setPositionSymbol(event.target.value)}
                  placeholder="Es. SWDA"
                />
              </label>

              <label className="stack">
                Valore EUR
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={positionValue}
                  onChange={(event) => setPositionValue(event.target.value)}
                />
              </label>

              <div className="actions-row">
                <button type="submit" disabled={offlineReadOnly}>
                  {positionEditingId ? 'Salva modifica' : 'Aggiungi posizione'}
                </button>
                {positionEditingId ? (
                  <button type="button" className="secondary" onClick={resetPositionForm}>
                    Annulla
                  </button>
                ) : null}
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Conto</th>
                    <th>Nome</th>
                    <th>Ticker</th>
                    <th>Valore</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvestmentPositions.map((position) => {
                    const account = accountById.get(position.account_id)

                    return (
                      <tr key={position.id}>
                        <td>{account?.name ?? '-'}</td>
                        <td>{position.name}</td>
                        <td>{position.symbol ?? '-'}</td>
                        <td>{formatCurrency(Number(position.current_value_eur))}</td>
                        <td>
                          <div className="inline-actions">
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => beginPositionEdit(position)}
                            >
                              Modifica
                            </button>
                            <button
                              type="button"
                              className="ghost danger"
                              disabled={offlineReadOnly}
                              onClick={() =>
                                void runAction(
                                  () => deletePosition(position.id),
                                  'Posizione eliminata',
                                )
                              }
                            >
                              Elimina
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {visibleInvestmentPositions.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Nessuna posizione disponibile.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  )
}

function goalLabel(category: GoalCategory): string {
  if (category === 'bank') {
    return 'Conti'
  }

  if (category === 'investment') {
    return 'Investimenti'
  }

  return 'Totale patrimonio'
}

function SupabaseSetupScreen() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Configura Supabase</h1>
        <p>
          Crea un file <code>.env</code> nella root con:
        </p>
        <pre>{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY`}</pre>
        <p className="muted">Poi riavvia con `npm run dev`.</p>
      </section>
    </main>
  )
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>{label}</h1>
      </section>
    </main>
  )
}

export default App
