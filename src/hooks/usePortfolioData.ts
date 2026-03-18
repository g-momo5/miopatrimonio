import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
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
  updateInstitution: (input: {
    institutionId: string
    name: string
    kind: InstitutionKind
    iconMode: InstitutionIcon
    iconKey?: string | null
    iconUrl?: string | null
    logoScale: number
    logoOffsetX: number
    logoOffsetY: number
  }) => Promise<void>
  upsertPresetInstitutionOverride: (input: {
    presetKey: string
    defaultName: string
    defaultKind: InstitutionKind
    name: string
    iconMode: InstitutionIcon
    iconUrl?: string | null
    logoScale: number
    logoOffsetX: number
    logoOffsetY: number
  }) => Promise<void>
  createAccount: (input: {
    name: string
    accountType: 'bank' | 'investment'
    initialBalanceEur: number
    institution: {
      name: string
      kind: InstitutionKind
      iconMode: InstitutionIcon
      iconKey?: string | null
      iconUrl?: string | null
      logoScale: number
      logoOffsetX: number
      logoOffsetY: number
    }
  }) => Promise<void>
  updateAccount: (input: {
    accountId: string
    name: string
    accountType: 'bank' | 'investment'
    institution: {
      name: string
      kind: InstitutionKind
      iconMode: InstitutionIcon
      iconKey?: string | null
      iconUrl?: string | null
      logoScale: number
      logoOffsetX: number
      logoOffsetY: number
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

  const updateInstitution = useCallback(
    async (input: {
      institutionId: string
      name: string
      kind: InstitutionKind
      iconMode: InstitutionIcon
      iconKey?: string | null
      iconUrl?: string | null
      logoScale: number
      logoOffsetX: number
      logoOffsetY: number
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()
      const institutionName = input.name.trim()

      if (!institutionName) {
        throw new Error('Nome istituto non valido')
      }

      const style = normalizeLogoStyle(
        input.logoScale,
        input.logoOffsetX,
        input.logoOffsetY,
      )

      const { error: updateError } = await supabase
        .from('institutions')
        .update({
          name: institutionName,
          kind: input.kind,
          icon_mode: input.iconMode,
          icon_key: input.iconKey ?? null,
          icon_url: input.iconUrl?.trim() || null,
          logo_scale: style.logoScale,
          logo_offset_x: style.logoOffsetX,
          logo_offset_y: style.logoOffsetY,
        })
        .eq('id', input.institutionId)
        .eq('user_id', userId)

      if (updateError) {
        if (!isMissingLogoStyleColumnsError(updateError)) {
          throw new Error(updateError.message)
        }

        const { error: fallbackUpdateError } = await supabase
          .from('institutions')
          .update({
            name: institutionName,
            kind: input.kind,
            icon_mode: input.iconMode,
            icon_key: input.iconKey ?? null,
            icon_url: input.iconUrl?.trim() || null,
          })
          .eq('id', input.institutionId)
          .eq('user_id', userId)

        if (fallbackUpdateError) {
          throw new Error(fallbackUpdateError.message)
        }
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const upsertPresetInstitutionOverride = useCallback(
    async (input: {
      presetKey: string
      defaultName: string
      defaultKind: InstitutionKind
      name: string
      iconMode: InstitutionIcon
      iconUrl?: string | null
      logoScale: number
      logoOffsetX: number
      logoOffsetY: number
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()
      const institutionName = input.name.trim()

      if (!institutionName) {
        throw new Error('Nome istituto non valido')
      }

      const style = normalizeLogoStyle(
        input.logoScale,
        input.logoOffsetX,
        input.logoOffsetY,
      )

      const { data: existingRows, error: lookupError } = await supabase
        .from('institutions')
        .select('id')
        .eq('user_id', userId)
        .eq('icon_key', input.presetKey)
        .order('created_at', { ascending: true })
        .limit(1)

      if (lookupError) {
        throw new Error(lookupError.message)
      }

      const existingInstitution = existingRows?.[0]
      const payload = {
        user_id: userId,
        name: institutionName || input.defaultName,
        kind: input.defaultKind,
        icon_mode: input.iconMode,
        icon_key: input.presetKey,
        icon_url: input.iconUrl?.trim() || null,
        logo_scale: style.logoScale,
        logo_offset_x: style.logoOffsetX,
        logo_offset_y: style.logoOffsetY,
      }

      if (existingInstitution?.id) {
        const { error: updateError } = await supabase
          .from('institutions')
          .update(payload)
          .eq('id', existingInstitution.id)
          .eq('user_id', userId)

        if (updateError) {
          if (!isMissingLogoStyleColumnsError(updateError)) {
            throw new Error(updateError.message)
          }

          const { error: fallbackUpdateError } = await supabase
            .from('institutions')
            .update({
              user_id: userId,
              name: institutionName || input.defaultName,
              kind: input.defaultKind,
              icon_mode: input.iconMode,
              icon_key: input.presetKey,
              icon_url: input.iconUrl?.trim() || null,
            })
            .eq('id', existingInstitution.id)
            .eq('user_id', userId)

          if (fallbackUpdateError) {
            throw new Error(fallbackUpdateError.message)
          }
        }
      } else {
        const { error: insertError } = await supabase
          .from('institutions')
          .insert(payload)

        if (insertError) {
          if (!isMissingLogoStyleColumnsError(insertError)) {
            throw new Error(insertError.message)
          }

          const { error: fallbackInsertError } = await supabase
            .from('institutions')
            .insert({
              user_id: userId,
              name: institutionName || input.defaultName,
              kind: input.defaultKind,
              icon_mode: input.iconMode,
              icon_key: input.presetKey,
              icon_url: input.iconUrl?.trim() || null,
            })

          if (fallbackInsertError) {
            throw new Error(fallbackInsertError.message)
          }
        }
      }

      await refresh()
    },
    [ensureWritable, refresh, userId],
  )

  const getOrCreateInstitutionId = useCallback(
    async (
      supabase: SupabaseClient,
      input: {
        name: string
        kind: InstitutionKind
        iconMode: InstitutionIcon
        iconKey?: string | null
        iconUrl?: string | null
        logoScale: number
        logoOffsetX: number
        logoOffsetY: number
      },
    ): Promise<string> => {
      const institutionName = input.name.trim()
      const presetKey = input.iconKey?.trim() || null
      const style = normalizeLogoStyle(
        input.logoScale,
        input.logoOffsetX,
        input.logoOffsetY,
      )

      let institutionLookup = supabase
        .from('institutions')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)

      institutionLookup = presetKey
        ? institutionLookup.eq('icon_key', presetKey)
        : institutionLookup.eq('name', institutionName)

      const { data: existingRows, error: lookupError } = await institutionLookup

      if (lookupError) {
        throw new Error(lookupError.message)
      }

      let institutionId = existingRows?.[0]?.id

      if (!institutionId) {
        const insertPayloadWithStyle = {
          user_id: userId,
          name: institutionName,
          kind: input.kind,
          icon_mode: input.iconMode,
          icon_key: presetKey,
          icon_url: input.iconUrl?.trim() || null,
          logo_scale: style.logoScale,
          logo_offset_x: style.logoOffsetX,
          logo_offset_y: style.logoOffsetY,
        }
        const insertPayloadLegacy = {
          user_id: userId,
          name: institutionName,
          kind: input.kind,
          icon_mode: input.iconMode,
          icon_key: presetKey,
          icon_url: input.iconUrl?.trim() || null,
        }

        let createdInstitution: { id: string } | null = null
        let createInstitutionError: { code?: string; message: string } | null = null

        const withStyleResult = await supabase
          .from('institutions')
          .insert(insertPayloadWithStyle)
          .select('id')
          .maybeSingle()

        createdInstitution = withStyleResult.data
        createInstitutionError = withStyleResult.error

        if (createInstitutionError && isMissingLogoStyleColumnsError(createInstitutionError)) {
          const fallbackResult = await supabase
            .from('institutions')
            .insert(insertPayloadLegacy)
            .select('id')
            .maybeSingle()

          createdInstitution = fallbackResult.data
          createInstitutionError = fallbackResult.error
        }

        if (createInstitutionError && createInstitutionError.code !== '23505') {
          throw new Error(createInstitutionError.message)
        }

        institutionId = createdInstitution?.id

        if (!institutionId) {
          let retryLookup = supabase
            .from('institutions')
            .select('id')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(1)

          retryLookup = presetKey
            ? retryLookup.eq('icon_key', presetKey)
            : retryLookup.eq('name', institutionName)

          const { data: retryRows, error: retryLookupError } = await retryLookup

          if (retryLookupError) {
            throw new Error(retryLookupError.message)
          }

          institutionId = retryRows?.[0]?.id
        }
      }

      if (!institutionId) {
        throw new Error('Non è stato possibile creare o recuperare l’istituto')
      }

      return institutionId
    },
    [userId],
  )

  const createAccount = useCallback(
    async (input: {
      name: string
      accountType: 'bank' | 'investment'
      initialBalanceEur: number
      institution: {
        name: string
        kind: InstitutionKind
        iconMode: InstitutionIcon
        iconKey?: string | null
        iconUrl?: string | null
        logoScale: number
        logoOffsetX: number
        logoOffsetY: number
      }
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()
      const accountName = input.name.trim()
      const initialBalance = Number(input.initialBalanceEur)

      if (!accountName) {
        throw new Error('Nome conto non valido')
      }

      if (!Number.isFinite(initialBalance) || initialBalance < 0) {
        throw new Error('Saldo iniziale non valido')
      }

      const institutionId = await getOrCreateInstitutionId(supabase, input.institution)

      const { data: createdAccount, error: insertError } = await supabase
        .from('accounts')
        .insert({
          user_id: userId,
          name: accountName,
          account_type: input.accountType,
          institution_id: institutionId,
          currency: 'EUR',
        })
        .select('id')
        .maybeSingle()

      if (insertError) {
        throw new Error(insertError.message)
      }

      const accountId = createdAccount?.id

      if (!accountId) {
        throw new Error('Non è stato possibile creare il conto')
      }

      const today = new Date().toISOString().slice(0, 10)

      const { error: snapshotError } = await supabase.from('account_snapshots').insert({
        user_id: userId,
        account_id: accountId,
        snapshot_date: today,
        value_eur: initialBalance,
        note: null,
      })

      if (snapshotError) {
        await supabase.from('accounts').delete().eq('id', accountId).eq('user_id', userId)
        throw new Error(snapshotError.message)
      }

      await refresh()
    },
    [ensureWritable, getOrCreateInstitutionId, refresh, userId],
  )

  const updateAccount = useCallback(
    async (input: {
      accountId: string
      name: string
      accountType: 'bank' | 'investment'
      institution: {
        name: string
        kind: InstitutionKind
        iconMode: InstitutionIcon
        iconKey?: string | null
        iconUrl?: string | null
        logoScale: number
        logoOffsetX: number
        logoOffsetY: number
      }
    }) => {
      ensureWritable()
      const supabase = getSupabaseOrThrow()
      const accountName = input.name.trim()

      if (!accountName) {
        throw new Error('Nome conto non valido')
      }

      const institutionId = await getOrCreateInstitutionId(supabase, input.institution)

      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          name: accountName,
          account_type: input.accountType,
          institution_id: institutionId,
        })
        .eq('id', input.accountId)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await refresh()
    },
    [ensureWritable, getOrCreateInstitutionId, refresh, userId],
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
        logo_scale: institution.logoScale,
        logo_offset_x: institution.logoOffsetX,
        logo_offset_y: institution.logoOffsetY,
      }))

      const presetInstitutionRows = institutionRows.filter(
        (institution) => institution.icon_key !== null,
      )
      const customInstitutionRows = institutionRows.filter(
        (institution) => institution.icon_key === null,
      )

      if (presetInstitutionRows.length > 0) {
        const { error: institutionsError } = await supabase
          .from('institutions')
          .upsert(presetInstitutionRows, {
            onConflict: 'user_id,icon_key',
          })

        if (institutionsError) {
          if (!isMissingLogoStyleColumnsError(institutionsError)) {
            throw new Error(institutionsError.message)
          }

          const legacyPresetRows = presetInstitutionRows.map((institution) => ({
            user_id: institution.user_id,
            name: institution.name,
            kind: institution.kind,
            icon_mode: institution.icon_mode,
            icon_key: institution.icon_key,
            icon_url: institution.icon_url,
          }))

          const { error: legacyInstitutionsError } = await supabase
            .from('institutions')
            .upsert(legacyPresetRows, {
              onConflict: 'user_id,icon_key',
            })

          if (legacyInstitutionsError) {
            throw new Error(legacyInstitutionsError.message)
          }
        }
      }

      if (customInstitutionRows.length > 0) {
        const { error: institutionsError } = await supabase
          .from('institutions')
          .upsert(customInstitutionRows, {
            onConflict: 'user_id,name',
          })

        if (institutionsError) {
          if (!isMissingLogoStyleColumnsError(institutionsError)) {
            throw new Error(institutionsError.message)
          }

          const legacyCustomRows = customInstitutionRows.map((institution) => ({
            user_id: institution.user_id,
            name: institution.name,
            kind: institution.kind,
            icon_mode: institution.icon_mode,
            icon_key: institution.icon_key,
            icon_url: institution.icon_url,
          }))

          const { error: legacyInstitutionsError } = await supabase
            .from('institutions')
            .upsert(legacyCustomRows, {
              onConflict: 'user_id,name',
            })

          if (legacyInstitutionsError) {
            throw new Error(legacyInstitutionsError.message)
          }
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
  }
}

function normalizeState(state: PortfolioDataState): PortfolioDataState {
  return {
    institutions: state.institutions.map((institution) => ({
      ...institution,
      icon_key: institution.icon_key ?? null,
      icon_url: institution.icon_url ?? null,
      logo_scale: Number(institution.logo_scale ?? 1),
      logo_offset_x: Number(institution.logo_offset_x ?? 0),
      logo_offset_y: Number(institution.logo_offset_y ?? 0),
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

function normalizeLogoStyle(
  logoScale: number,
  logoOffsetX: number,
  logoOffsetY: number,
): {
  logoScale: number
  logoOffsetX: number
  logoOffsetY: number
} {
  const normalizedScale = Number.isFinite(logoScale)
    ? Math.min(Math.max(logoScale, 0.6), 2.4)
    : 1
  const normalizedOffsetX = Number.isFinite(logoOffsetX)
    ? Math.min(Math.max(logoOffsetX, -40), 40)
    : 0
  const normalizedOffsetY = Number.isFinite(logoOffsetY)
    ? Math.min(Math.max(logoOffsetY, -40), 40)
    : 0

  return {
    logoScale: Number(normalizedScale.toFixed(3)),
    logoOffsetX: Number(normalizedOffsetX.toFixed(3)),
    logoOffsetY: Number(normalizedOffsetY.toFixed(3)),
  }
}

function isMissingLogoStyleColumnsError(error: {
  code?: string | null
  message?: string | null
}): boolean {
  const message = error.message?.toLowerCase() ?? ''

  return (
    error.code === '42703' ||
    message.includes('logo_scale') ||
    message.includes('logo_offset_x') ||
    message.includes('logo_offset_y')
  )
}
