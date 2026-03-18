import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseOrThrow } from '../lib/supabase'
import { parseBackupPayload } from '../lib/backup'
import type {
  Account,
  AccountSnapshot,
  Goal,
  GoalCategory,
  Institution,
  InstitutionIcon,
  InstitutionKind,
  InvestmentPosition,
  PortfolioDataState,
} from '../types'

const CACHE_KEY_PREFIX = 'mio-patrimonio-cache'

const EMPTY_STATE: PortfolioDataState = {
  institutions: [],
  accounts: [],
  snapshots: [],
  positions: [],
  goals: [],
}

interface UsePortfolioDataResult {
  data: PortfolioDataState
  loading: boolean
  error: string | null
  offlineReadOnly: boolean
  refresh: () => Promise<void>
  addInstitution: (input: {
    name: string
    kind: InstitutionKind
    iconMode: InstitutionIcon
    iconKey?: string | null
    iconUrl?: string | null
  }) => Promise<void>
  createAccount: (input: {
    name: string
    accountType: 'bank' | 'investment'
    institution: {
      name: string
      kind: InstitutionKind
      iconMode: InstitutionIcon
      iconKey?: string | null
      iconUrl?: string | null
    }
  }) => Promise<void>
  toggleArchiveAccount: (accountId: string, isArchived: boolean) => Promise<void>
  addOrUpdateSnapshot: (input: {
    snapshotId?: string
    accountId: string
    date: string
    valueEur: number
    note?: string
  }) => Promise<void>
  deleteSnapshot: (snapshotId: string) => Promise<void>
  addOrUpdatePosition: (input: {
    positionId?: string
    accountId: string
    name: string
    symbol?: string
    currentValueEur: number
  }) => Promise<void>
  deletePosition: (positionId: string) => Promise<void>
  addOrUpdateGoal: (input: { category: GoalCategory; targetEur: number }) => Promise<void>
  deleteGoal: (goalId: string) => Promise<void>
  importBackup: (raw: unknown) => Promise<void>
}

export function usePortfolioData(
  userId: string | undefined,
  isOnline: boolean,
): UsePortfolioDataResult {
  const [data, setData] = useState<PortfolioDataState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheKey = useMemo(
    () => `${CACHE_KEY_PREFIX}:${userId ?? 'anonymous'}`,
    [userId],
  )

  const loadCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (!raw) {
        return null
      }

      return normalizeState(JSON.parse(raw) as PortfolioDataState)
    } catch {
      return null
    }
  }, [cacheKey])

  const persistCache = useCallback(
    (nextData: PortfolioDataState) => {
      localStorage.setItem(cacheKey, JSON.stringify(nextData))
    },
    [cacheKey],
  )

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(EMPTY_STATE)
      setLoading(false)
      return
    }

    const cached = loadCache()

    if (!isOnline) {
      if (cached) {
        setData(cached)
      }

      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabaseOrThrow()

      const [institutionsResult, accountsResult, snapshotsResult, positionsResult, goalsResult] =
        await Promise.all([
          supabase
            .from('institutions')
            .select('*')
            .eq('user_id', userId)
            .order('name', { ascending: true }),
          supabase
            .from('accounts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }),
          supabase
            .from('account_snapshots')
            .select('*')
            .eq('user_id', userId)
            .order('snapshot_date', { ascending: false }),
          supabase
            .from('investment_positions')
            .select('*')
            .eq('user_id', userId)
            .order('name', { ascending: true }),
          supabase
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .order('category', { ascending: true }),
        ])

      const failures = [
        institutionsResult.error,
        accountsResult.error,
        snapshotsResult.error,
        positionsResult.error,
        goalsResult.error,
      ].filter(Boolean)

      if (failures.length > 0) {
        throw new Error(failures[0]?.message ?? 'Errore caricamento dati')
      }

      const nextState = normalizeState({
        institutions: institutionsResult.data ?? [],
        accounts: accountsResult.data ?? [],
        snapshots: snapshotsResult.data ?? [],
        positions: positionsResult.data ?? [],
        goals: goalsResult.data ?? [],
      })

      setData(nextState)
      persistCache(nextState)
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : 'Errore durante il caricamento dati'
      setError(message)

      if (cached) {
        setData(cached)
      }
    } finally {
      setLoading(false)
    }
  }, [isOnline, loadCache, persistCache, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ensureWritable = useCallback(() => {
    if (!isOnline) {
      throw new Error('Sei offline: in questa modalità puoi solo consultare i dati.')
    }

    if (!userId) {
      throw new Error('Utente non autenticato')
    }
  }, [isOnline, userId])

  const addInstitution = useCallback(
    async (input: {
      name: string
      kind: InstitutionKind
      iconMode: InstitutionIcon
      iconKey?: string | null
      iconUrl?: string | null
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      const { error: insertError } = await supabase.from('institutions').insert({
        user_id: userId,
        name: input.name.trim(),
        kind: input.kind,
        icon_mode: input.iconMode,
        icon_key: input.iconKey ?? null,
        icon_url: input.iconUrl ?? null,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const createAccount = useCallback(
    async (input: {
      name: string
      accountType: 'bank' | 'investment'
      institution: {
        name: string
        kind: InstitutionKind
        iconMode: InstitutionIcon
        iconKey?: string | null
        iconUrl?: string | null
      }
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()
      const institutionName = input.institution.name.trim()
      const accountName = input.name.trim()

      if (!institutionName) {
        throw new Error('Nome istituto non valido')
      }

      if (!accountName) {
        throw new Error('Nome conto non valido')
      }

      const { data: existingInstitution, error: lookupError } = await supabase
        .from('institutions')
        .select('id')
        .eq('user_id', userId)
        .eq('name', institutionName)
        .maybeSingle()

      if (lookupError) {
        throw new Error(lookupError.message)
      }

      let institutionId = existingInstitution?.id

      if (!institutionId) {
        const { data: createdInstitution, error: createInstitutionError } = await supabase
          .from('institutions')
          .insert({
            user_id: userId,
            name: institutionName,
            kind: input.institution.kind,
            icon_mode: input.institution.iconMode,
            icon_key: input.institution.iconKey ?? null,
            icon_url: input.institution.iconUrl ?? null,
          })
          .select('id')
          .maybeSingle()

        if (createInstitutionError && createInstitutionError.code !== '23505') {
          throw new Error(createInstitutionError.message)
        }

        institutionId = createdInstitution?.id

        if (!institutionId) {
          const { data: retryInstitution, error: retryLookupError } = await supabase
            .from('institutions')
            .select('id')
            .eq('user_id', userId)
            .eq('name', institutionName)
            .maybeSingle()

          if (retryLookupError) {
            throw new Error(retryLookupError.message)
          }

          institutionId = retryInstitution?.id
        }
      }

      if (!institutionId) {
        throw new Error('Non è stato possibile creare o recuperare l’istituto')
      }

      const { error: insertError } = await supabase.from('accounts').insert({
        user_id: userId,
        name: accountName,
        account_type: input.accountType,
        institution_id: institutionId,
        currency: 'EUR',
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const toggleArchiveAccount = useCallback(
    async (accountId: string, isArchived: boolean) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      const { error: updateError } = await supabase
        .from('accounts')
        .update({ is_archived: isArchived })
        .eq('id', accountId)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const addOrUpdateSnapshot = useCallback(
    async (input: {
      snapshotId?: string
      accountId: string
      date: string
      valueEur: number
      note?: string
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      if (input.snapshotId) {
        const { error: updateError } = await supabase
          .from('account_snapshots')
          .update({
            snapshot_date: input.date,
            value_eur: input.valueEur,
            note: input.note?.trim() ? input.note.trim() : null,
          })
          .eq('id', input.snapshotId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: upsertError } = await supabase
          .from('account_snapshots')
          .upsert(
            {
              user_id: userId,
              account_id: input.accountId,
              snapshot_date: input.date,
              value_eur: input.valueEur,
              note: input.note?.trim() ? input.note.trim() : null,
            },
            {
              onConflict: 'user_id,account_id,snapshot_date',
            },
          )

        if (upsertError) {
          throw new Error(upsertError.message)
        }
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      const { error: deleteError } = await supabase
        .from('account_snapshots')
        .delete()
        .eq('id', snapshotId)
        .eq('user_id', userId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const addOrUpdatePosition = useCallback(
    async (input: {
      positionId?: string
      accountId: string
      name: string
      symbol?: string
      currentValueEur: number
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      if (input.positionId) {
        const { error: updateError } = await supabase
          .from('investment_positions')
          .update({
            name: input.name.trim(),
            symbol: input.symbol?.trim() ? input.symbol.trim().toUpperCase() : null,
            current_value_eur: input.currentValueEur,
          })
          .eq('id', input.positionId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: upsertError } = await supabase
          .from('investment_positions')
          .upsert(
            {
              user_id: userId,
              account_id: input.accountId,
              name: input.name.trim(),
              symbol: input.symbol?.trim() ? input.symbol.trim().toUpperCase() : null,
              current_value_eur: input.currentValueEur,
            },
            {
              onConflict: 'user_id,account_id,name',
            },
          )

        if (upsertError) {
          throw new Error(upsertError.message)
        }
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const deletePosition = useCallback(
    async (positionId: string) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      const { error: deleteError } = await supabase
        .from('investment_positions')
        .delete()
        .eq('id', positionId)
        .eq('user_id', userId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const addOrUpdateGoal = useCallback(
    async (input: { category: GoalCategory; targetEur: number }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      const { error: upsertError } = await supabase.from('goals').upsert(
        {
          user_id: userId,
          category: input.category,
          target_eur: input.targetEur,
        },
        {
          onConflict: 'user_id,category',
        },
      )

      if (upsertError) {
        throw new Error(upsertError.message)
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const deleteGoal = useCallback(
    async (goalId: string) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()

      const { error: deleteError } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', userId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const importBackup = useCallback(
    async (raw: unknown) => {
      ensureWritable()
      const payload = parseBackupPayload(raw)
      const supabase = getSupabaseOrThrow()

      const institutionRows = payload.institutions.map((institution) => ({
        user_id: userId,
        name: institution.name,
        kind: institution.kind,
        icon_mode: institution.iconMode,
        icon_key: institution.iconKey,
        icon_url: institution.iconUrl,
      }))

      if (institutionRows.length > 0) {
        const { error: institutionsError } = await supabase
          .from('institutions')
          .upsert(institutionRows, {
            onConflict: 'user_id,name',
          })

        if (institutionsError) {
          throw new Error(institutionsError.message)
        }
      }

      const { data: institutions, error: institutionsFetchError } = await supabase
        .from('institutions')
        .select('*')
        .eq('user_id', userId)

      if (institutionsFetchError) {
        throw new Error(institutionsFetchError.message)
      }

      const institutionIdByName = new Map(
        (institutions ?? []).map((institution) => [institution.name, institution.id]),
      )

      const accountRows = payload.accounts.map((account) => {
        const institutionId = institutionIdByName.get(account.institutionName)
        if (!institutionId) {
          throw new Error(`Istituto non trovato durante import: ${account.institutionName}`)
        }

        return {
          user_id: userId,
          name: account.name,
          account_type: account.accountType,
          institution_id: institutionId,
          is_archived: account.isArchived,
          currency: 'EUR',
        }
      })

      if (accountRows.length > 0) {
        const { error: accountsError } = await supabase.from('accounts').upsert(
          accountRows,
          {
            onConflict: 'user_id,name',
          },
        )

        if (accountsError) {
          throw new Error(accountsError.message)
        }
      }

      const { data: accounts, error: accountsFetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)

      if (accountsFetchError) {
        throw new Error(accountsFetchError.message)
      }

      const accountIdByName = new Map(
        (accounts ?? []).map((account) => [account.name, account.id]),
      )

      const snapshotRows = payload.snapshots.map((snapshot) => {
        const accountId = accountIdByName.get(snapshot.accountName)

        if (!accountId) {
          throw new Error(`Conto non trovato durante import: ${snapshot.accountName}`)
        }

        return {
          user_id: userId,
          account_id: accountId,
          snapshot_date: snapshot.snapshotDate,
          value_eur: snapshot.valueEur,
          note: snapshot.note,
        }
      })

      if (snapshotRows.length > 0) {
        const { error: snapshotsError } = await supabase
          .from('account_snapshots')
          .upsert(snapshotRows, {
            onConflict: 'user_id,account_id,snapshot_date',
          })

        if (snapshotsError) {
          throw new Error(snapshotsError.message)
        }
      }

      const positionRows = payload.positions.map((position) => {
        const accountId = accountIdByName.get(position.accountName)

        if (!accountId) {
          throw new Error(`Conto investimento non trovato: ${position.accountName}`)
        }

        return {
          user_id: userId,
          account_id: accountId,
          name: position.name,
          symbol: position.symbol,
          current_value_eur: position.currentValueEur,
        }
      })

      if (positionRows.length > 0) {
        const { error: positionsError } = await supabase
          .from('investment_positions')
          .upsert(positionRows, {
            onConflict: 'user_id,account_id,name',
          })

        if (positionsError) {
          throw new Error(positionsError.message)
        }
      }

      const goalRows = payload.goals.map((goal) => ({
        user_id: userId,
        category: goal.category,
        target_eur: goal.targetEur,
      }))

      if (goalRows.length > 0) {
        const { error: goalsError } = await supabase.from('goals').upsert(goalRows, {
          onConflict: 'user_id,category',
        })

        if (goalsError) {
          throw new Error(goalsError.message)
        }
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  return {
    data,
    loading,
    error,
    offlineReadOnly: !isOnline,
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
  }
}

function normalizeState(state: PortfolioDataState): PortfolioDataState {
  return {
    institutions: state.institutions.map((institution) => ({
      ...institution,
      icon_key: institution.icon_key ?? null,
      icon_url: institution.icon_url ?? null,
    })) as Institution[],
    accounts: state.accounts.map((account) => ({
      ...account,
      currency: 'EUR',
      is_archived: Boolean(account.is_archived),
    })) as Account[],
    snapshots: state.snapshots.map((snapshot) => ({
      ...snapshot,
      value_eur: Number(snapshot.value_eur),
      note: snapshot.note ?? null,
    })) as AccountSnapshot[],
    positions: state.positions.map((position) => ({
      ...position,
      current_value_eur: Number(position.current_value_eur),
      symbol: position.symbol ?? null,
    })) as InvestmentPosition[],
    goals: state.goals.map((goal) => ({
      ...goal,
      target_eur: Number(goal.target_eur),
    })) as Goal[],
  }
}
