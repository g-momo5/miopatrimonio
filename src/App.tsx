import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { InstitutionAvatar } from './components/InstitutionAvatar'
import { PortfolioCharts } from './components/PortfolioCharts'
import { PRESET_INSTITUTIONS } from './constants/presetInstitutions'
import {
  buildLatestSnapshotMap,
  buildTrendSeries,
  computeGoalProgress,
  computeNetWorth,
} from './lib/calculations'
import { buildBackupPayload, downloadFile, toSnapshotsCsv } from './lib/backup'
import { capitalize, formatCurrency, formatDate } from './lib/format'
import { resolveInstitutionLogoCandidates } from './lib/institutionLogos'
import { useAuth } from './hooks/useAuth'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { usePortfolioData } from './hooks/usePortfolioData'
import type {
  AccountSnapshot,
  GoalCategory,
  InvestmentPosition,
} from './types'
import './App.css'

interface Feedback {
  kind: 'success' | 'error'
  message: string
}

const TODAY = new Date().toISOString().slice(0, 10)

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
    addInstitution,
    createAccount,
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

  const [institutionMode, setInstitutionMode] = useState<'preset' | 'custom'>('preset')
  const [selectedPresetInstitution, setSelectedPresetInstitution] = useState(
    PRESET_INSTITUTIONS[0].key,
  )
  const [customInstitutionName, setCustomInstitutionName] = useState('')
  const [customInstitutionLogoUrl, setCustomInstitutionLogoUrl] = useState('')

  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<'bank' | 'investment'>('bank')
  const [accountInstitutionMode, setAccountInstitutionMode] = useState<'preset' | 'custom'>(
    'preset',
  )
  const [accountPresetInstitutionKey, setAccountPresetInstitutionKey] = useState(
    PRESET_INSTITUTIONS[0].key,
  )
  const [accountCustomInstitutionName, setAccountCustomInstitutionName] = useState('')
  const [accountCustomInstitutionLogoUrl, setAccountCustomInstitutionLogoUrl] = useState('')
  const [showInstitutionTools, setShowInstitutionTools] = useState(false)

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
      summary.byInstitution.map((item) => ({
        name: item.institutionName,
        value: item.value,
      })),
    [summary.byInstitution],
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

  async function handleAddInstitution(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await runAction(async () => {
      if (institutionMode === 'preset') {
        const preset = PRESET_INSTITUTIONS.find(
          (candidate) => candidate.key === selectedPresetInstitution,
        )

        if (!preset) {
          throw new Error('Istituto predefinito non valido')
        }

        await addInstitution({
          name: preset.name,
          kind: preset.kind,
          iconMode: 'predefined',
          iconKey: preset.key,
          iconUrl: preset.logoPath,
        })
      } else {
        const name = customInstitutionName.trim()
        if (!name) {
          throw new Error('Inserisci il nome del nuovo istituto')
        }

        await addInstitution({
          name,
          kind: 'custom',
          iconMode: customInstitutionLogoUrl.trim() ? 'custom' : 'predefined',
          iconUrl: customInstitutionLogoUrl.trim() || null,
          iconKey: null,
        })

        setCustomInstitutionName('')
        setCustomInstitutionLogoUrl('')
      }
    }, 'Istituto aggiunto')
  }

  async function handleAddAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await runAction(async () => {
      const name = accountName.trim()

      if (!name) {
        throw new Error('Inserisci il nome del conto')
      }

      const institution =
        accountInstitutionMode === 'preset'
          ? PRESET_INSTITUTIONS.find(
              (preset) => preset.key === accountPresetInstitutionKey,
            )
          : null

      if (accountInstitutionMode === 'preset' && !institution) {
        throw new Error('Istituto predefinito non valido')
      }

      if (
        accountInstitutionMode === 'custom' &&
        !accountCustomInstitutionName.trim()
      ) {
        throw new Error('Inserisci il nome della banca o broker')
      }

      await createAccount({
        name,
        accountType,
        institution:
          accountInstitutionMode === 'preset' && institution
            ? {
                name: institution.name,
                kind: institution.kind,
                iconMode: 'predefined',
                iconKey: institution.key,
                iconUrl: institution.logoPath,
              }
            : {
                name: accountCustomInstitutionName.trim(),
                kind: accountType === 'investment' ? 'broker' : 'bank',
                iconMode: 'custom',
                iconKey: null,
                iconUrl: accountCustomInstitutionLogoUrl.trim() || null,
              },
      })

      setAccountName('')
      setAccountCustomInstitutionName('')
      setAccountCustomInstitutionLogoUrl('')
    }, 'Conto creato')
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

      {offlineReadOnly ? (
        <div className="banner warning">
          Sei offline: puoi consultare i dati cache, ma non modificare record.
        </div>
      ) : null}

      {authError ? <div className="banner error">{authError}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}
      {feedback ? <div className={`banner ${feedback.kind}`}>{feedback.message}</div> : null}

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
      />

      <section className="grid forms-grid">
        <article className="panel">
          <h2>Istituti (avanzato)</h2>
          <p className="muted">
            Gli istituti vengono creati automaticamente quando aggiungi un conto.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowInstitutionTools((current) => !current)}
          >
            {showInstitutionTools ? 'Nascondi strumenti avanzati' : 'Mostra strumenti avanzati'}
          </button>

          {showInstitutionTools ? (
            <form className="stack" onSubmit={handleAddInstitution}>
              <div className="toggle-row">
                <label>
                  <input
                    type="radio"
                    name="institutionMode"
                    checked={institutionMode === 'preset'}
                    onChange={() => setInstitutionMode('preset')}
                  />
                  Predefinito
                </label>
                <label>
                  <input
                    type="radio"
                    name="institutionMode"
                    checked={institutionMode === 'custom'}
                    onChange={() => setInstitutionMode('custom')}
                  />
                  Custom
                </label>
              </div>

              {institutionMode === 'preset' ? (
                <label className="stack">
                  Istituto predefinito
                  <select
                    value={selectedPresetInstitution}
                    onChange={(event) => setSelectedPresetInstitution(event.target.value)}
                  >
                    {PRESET_INSTITUTIONS.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="stack">
                    Nome istituto
                    <input
                      type="text"
                      value={customInstitutionName}
                      onChange={(event) => setCustomInstitutionName(event.target.value)}
                      placeholder="Es. Banca X"
                    />
                  </label>
                  <label className="stack">
                    URL logo (opzionale)
                    <input
                      type="url"
                      value={customInstitutionLogoUrl}
                      onChange={(event) => setCustomInstitutionLogoUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                </>
              )}

              <button type="submit" disabled={offlineReadOnly}>
                Aggiungi istituto
              </button>
            </form>
          ) : null}

          <div className="list">
            {data.institutions.map((institution) => (
              <div className="list-row" key={institution.id}>
                <InstitutionAvatar
                  name={institution.name}
                  iconCandidates={resolveInstitutionLogoCandidates(institution)}
                  size={30}
                />
                <div>
                  <strong>{institution.name}</strong>
                  <p className="muted">{capitalize(institution.kind)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Conti e investimenti</h2>
          <form className="stack" onSubmit={handleAddAccount}>
            <label className="stack">
              Nome conto
              <input
                type="text"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Es. Conto principale"
              />
            </label>

            <label className="stack">
              Tipo
              <select
                value={accountType}
                onChange={(event) =>
                  setAccountType(event.target.value as 'bank' | 'investment')
                }
              >
                <option value="bank">Conto corrente</option>
                <option value="investment">Investimento</option>
              </select>
            </label>

            <div className="toggle-row">
              <label>
                <input
                  type="radio"
                  name="accountInstitutionMode"
                  checked={accountInstitutionMode === 'preset'}
                  onChange={() => setAccountInstitutionMode('preset')}
                />
                Banca/Broker predefinito
              </label>
              <label>
                <input
                  type="radio"
                  name="accountInstitutionMode"
                  checked={accountInstitutionMode === 'custom'}
                  onChange={() => setAccountInstitutionMode('custom')}
                />
                Istituto personalizzato
              </label>
            </div>

            {accountInstitutionMode === 'preset' ? (
              <label className="stack">
                Istituto
                <select
                  value={accountPresetInstitutionKey}
                  onChange={(event) => setAccountPresetInstitutionKey(event.target.value)}
                >
                  {PRESET_INSTITUTIONS.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="stack">
                  Nome istituto personalizzato
                  <input
                    type="text"
                    value={accountCustomInstitutionName}
                    onChange={(event) => setAccountCustomInstitutionName(event.target.value)}
                    placeholder="Es. Banca locale"
                  />
                </label>
                <label className="stack">
                  URL logo (opzionale)
                  <input
                    type="url"
                    value={accountCustomInstitutionLogoUrl}
                    onChange={(event) => setAccountCustomInstitutionLogoUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </>
            )}

            <button type="submit" disabled={offlineReadOnly}>
              Crea conto
            </button>
          </form>

          <div className="list">
            {data.accounts.map((account) => {
              const institution = institutionById.get(account.institution_id)
              const latestSnapshot = latestSnapshotMap.get(account.id)

              return (
                <div className="list-row spread" key={account.id}>
                  <div className="inline">
                    <InstitutionAvatar
                      name={institution?.name ?? 'Istituto'}
                      iconCandidates={
                        institution
                          ? resolveInstitutionLogoCandidates(institution)
                          : undefined
                      }
                    />
                    <div>
                      <strong>{account.name}</strong>
                      <p className="muted">
                        {account.account_type === 'bank' ? 'Conto' : 'Investimento'} ·{' '}
                        {institution?.name ?? 'Istituto sconosciuto'}
                      </p>
                      <p className="amount-line">
                        Ultimo saldo:{' '}
                        {latestSnapshot
                          ? formatCurrency(Number(latestSnapshot.value_eur))
                          : 'N/D'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ghost"
                    disabled={offlineReadOnly}
                    onClick={() =>
                      void runAction(
                        () => toggleArchiveAccount(account.id, !account.is_archived),
                        account.is_archived
                          ? 'Conto riattivato'
                          : 'Conto archiviato',
                      )
                    }
                  >
                    {account.is_archived ? 'Riattiva' : 'Archivia'}
                  </button>
                </div>
              )
            })}
          </div>
        </article>

        <article className="panel panel-wide">
          <h2>Snapshot saldi</h2>
          <form className="grid form-grid" onSubmit={handleSubmitSnapshot}>
            <label className="stack">
              Conto
              <select
                value={snapshotAccountId}
                onChange={(event) => setSnapshotAccountId(event.target.value)}
              >
                <option value="">Seleziona...</option>
                {activeAccounts.map((account) => (
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
                {sortedSnapshots.map((snapshot) => {
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
              </tbody>
            </table>
          </div>
        </article>

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
                {data.positions.map((position) => {
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
              </tbody>
            </table>
          </div>
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
            <button type="button" className="secondary" onClick={() => void handleExportCsv()}>
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
