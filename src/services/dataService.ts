import type {
  DeficitRule,
  Envelope,
  FlexBudgetBackup,
  Profile,
  Transaction,
  Transfer,
} from '../types/finance'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import { getInitialBudgetTemplate } from './financialEngine'

const LOCAL_STORAGE_KEY_PREFIX = 'flexbudget_'

function getLocalData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key)
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

function setLocalData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(value))
  } catch (err) {
    console.error('Gagal menyimpan data lokal:', err)
  }
}

export class DataService {
  /**
   * Fetch user profile
   */
  static async getProfile(userId: string): Promise<Profile> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message)
      }

      if (data) {
        return {
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          opening_balance: Number(data.opening_balance || 0),
          currency: data.currency || 'IDR',
          timezone: data.timezone || 'Asia/Jakarta',
          created_at: data.created_at,
          updated_at: data.updated_at,
        }
      }
    }

    // Local fallback
    const localProfile = getLocalData<Profile | null>('profile', null)
    if (localProfile && localProfile.id === userId) {
      return localProfile
    }

    const defaultProfile: Profile = {
      id: userId,
      email: 'owner@flexbudget.app',
      full_name: 'Pemilik FlexBudget',
      opening_balance: 0,
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
    }
    setLocalData('profile', defaultProfile)
    return defaultProfile
  }

  /**
   * Update user profile / opening balance
   */
  static async updateProfile(profile: Profile): Promise<Profile> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          opening_balance: profile.opening_balance,
          currency: profile.currency,
          timezone: profile.timezone,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        ...profile,
        opening_balance: Number(data.opening_balance || 0),
      }
    }

    setLocalData('profile', profile)
    return profile
  }

  /**
   * Fetch all envelopes for user
   */
  static async getEnvelopes(userId: string): Promise<Envelope[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('envelopes')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

      if (error) throw new Error(error.message)
      return (data || []).map((e) => ({
        id: e.id,
        user_id: e.user_id,
        name: e.name,
        type: e.type,
        period_type: e.period_type,
        period_amount: Number(e.period_amount || 0),
        funding_source_id: e.funding_source_id,
        rollover_policy: e.rollover_policy,
        surplus_destination_id: e.surplus_destination_id,
        deficit_coverage_mode: e.deficit_coverage_mode,
        deficit_priority: e.deficit_priority || 0,
        min_protected_balance: Number(e.min_protected_balance || 0),
        is_archived: Boolean(e.is_archived),
        sort_order: e.sort_order || 0,
        created_at: e.created_at,
        updated_at: e.updated_at,
      }))
    }

    return getLocalData<Envelope[]>('envelopes', [])
  }

  /**
   * Save or update envelope
   */
  static async saveEnvelope(envelope: Envelope): Promise<Envelope> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('envelopes')
        .upsert({
          id: envelope.id,
          user_id: envelope.user_id,
          name: envelope.name,
          type: envelope.type,
          period_type: envelope.period_type,
          period_amount: envelope.period_amount,
          funding_source_id: envelope.funding_source_id,
          rollover_policy: envelope.rollover_policy,
          surplus_destination_id: envelope.surplus_destination_id,
          deficit_coverage_mode: envelope.deficit_coverage_mode,
          deficit_priority: envelope.deficit_priority,
          min_protected_balance: envelope.min_protected_balance,
          is_archived: envelope.is_archived,
          sort_order: envelope.sort_order,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        ...envelope,
        period_amount: Number(data.period_amount),
        min_protected_balance: Number(data.min_protected_balance),
      }
    }

    const current = getLocalData<Envelope[]>('envelopes', [])
    const index = current.findIndex((e) => e.id === envelope.id)
    if (index >= 0) {
      current[index] = envelope
    } else {
      current.push(envelope)
    }
    setLocalData('envelopes', current)
    return envelope
  }

  /**
   * Fetch transactions
   */
  static async getTransactions(userId: string): Promise<Transaction[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return (data || []).map((t) => ({
        id: t.id,
        user_id: t.user_id,
        type: t.type,
        amount: Number(t.amount),
        date: t.date,
        envelope_id: t.envelope_id,
        description: t.description,
        notes: t.notes,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }))
    }

    return getLocalData<Transaction[]>('transactions', [])
  }

  /**
   * Save or update transaction
   */
  static async saveTransaction(tx: Transaction): Promise<Transaction> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('transactions')
        .upsert({
          id: tx.id,
          user_id: tx.user_id,
          type: tx.type,
          amount: tx.amount,
          date: tx.date,
          envelope_id: tx.envelope_id,
          description: tx.description,
          notes: tx.notes,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        ...tx,
        amount: Number(data.amount),
      }
    }

    const current = getLocalData<Transaction[]>('transactions', [])
    const index = current.findIndex((t) => t.id === tx.id)
    if (index >= 0) {
      current[index] = tx
    } else {
      current.unshift(tx)
    }
    setLocalData('transactions', current)
    return tx
  }

  /**
   * Delete transaction
   */
  static async deleteTransaction(id: string, userId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw new Error(error.message)
      return
    }

    const current = getLocalData<Transaction[]>('transactions', [])
    setLocalData(
      'transactions',
      current.filter((t) => t.id !== id)
    )
  }

  /**
   * Fetch transfers ledger
   */
  static async getTransfers(userId: string): Promise<Transfer[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('transfers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return (data || []).map((t) => ({
        id: t.id,
        user_id: t.user_id,
        type: t.type,
        source_envelope_id: t.source_envelope_id,
        destination_envelope_id: t.destination_envelope_id,
        amount: Number(t.amount),
        description: t.description,
        related_transaction_id: t.related_transaction_id,
        period_key: t.period_key,
        created_at: t.created_at,
      }))
    }

    return getLocalData<Transfer[]>('transfers', [])
  }

  /**
   * Save transfer records atomically
   */
  static async saveTransfers(transfers: Transfer[]): Promise<Transfer[]> {
    if (transfers.length === 0) return []

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('transfers')
        .insert(
          transfers.map((t) => ({
            id: t.id,
            user_id: t.user_id,
            type: t.type,
            source_envelope_id: t.source_envelope_id,
            destination_envelope_id: t.destination_envelope_id,
            amount: t.amount,
            description: t.description,
            related_transaction_id: t.related_transaction_id,
            period_key: t.period_key,
            created_at: t.created_at || new Date().toISOString(),
          }))
        )
        .select()

      if (error) throw new Error(error.message)
      return (data || []).map((t) => ({
        id: t.id,
        user_id: t.user_id,
        type: t.type,
        source_envelope_id: t.source_envelope_id,
        destination_envelope_id: t.destination_envelope_id,
        amount: Number(t.amount),
        description: t.description,
        related_transaction_id: t.related_transaction_id,
        period_key: t.period_key,
        created_at: t.created_at,
      }))
    }

    const current = getLocalData<Transfer[]>('transfers', [])
    const updated = [...transfers, ...current]
    setLocalData('transfers', updated)
    return transfers
  }

  /**
   * Fetch deficit coverage rules
   */
  static async getDeficitRules(userId: string): Promise<DeficitRule[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('deficit_rules')
        .select('*')
        .eq('user_id', userId)
        .order('priority_order', { ascending: true })

      if (error) throw new Error(error.message)
      return (data || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        target_envelope_id: r.target_envelope_id,
        source_envelope_id: r.source_envelope_id,
        priority_order: r.priority_order,
        max_coverage_amount: r.max_coverage_amount ? Number(r.max_coverage_amount) : null,
        is_active: Boolean(r.is_active),
        created_at: r.created_at,
      }))
    }

    return getLocalData<DeficitRule[]>('deficit_rules', [])
  }

  /**
   * Save deficit rule
   */
  static async saveDeficitRule(rule: DeficitRule): Promise<DeficitRule> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('deficit_rules')
        .upsert({
          id: rule.id,
          user_id: rule.user_id,
          target_envelope_id: rule.target_envelope_id,
          source_envelope_id: rule.source_envelope_id,
          priority_order: rule.priority_order,
          max_coverage_amount: rule.max_coverage_amount,
          is_active: rule.is_active,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        ...rule,
        max_coverage_amount: data.max_coverage_amount ? Number(data.max_coverage_amount) : null,
      }
    }

    const current = getLocalData<DeficitRule[]>('deficit_rules', [])
    const index = current.findIndex((r) => r.id === rule.id)
    if (index >= 0) {
      current[index] = rule
    } else {
      current.push(rule)
    }
    setLocalData('deficit_rules', current)
    return rule
  }

  /**
   * Apply Initial Budget Template
   */
  static async applyInitialTemplate(userId: string): Promise<{
    envelopes: Envelope[]
    transfers: Transfer[]
  }> {
    const template = getInitialBudgetTemplate(userId)

    // Save envelopes
    const savedEnvelopes: Envelope[] = []
    for (const env of template.envelopes) {
      const saved = await this.saveEnvelope(env)
      savedEnvelopes.push(saved)
    }

    // Save initial allocation transfers
    const transfersToCreate: Transfer[] = template.initialAllocations.map((alloc, idx) => {
      const env = savedEnvelopes.find((e) => e.name === alloc.envelopeName)!
      return {
        id: crypto.randomUUID ? crypto.randomUUID() : `tr-init-${idx}-${Date.now()}`,
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: env.id,
        amount: alloc.amount,
        description: `Alokasi Awal: ${alloc.envelopeName}`,
        created_at: new Date().toISOString(),
      }
    })

    const savedTransfers = await this.saveTransfers(transfersToCreate)

    return {
      envelopes: savedEnvelopes,
      transfers: savedTransfers,
    }
  }

  /**
   * Restore full backup data
   */
  static async restoreBackup(backup: FlexBudgetBackup, userId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // Upsert profile
      await supabase.from('profiles').upsert({
        ...backup.profile,
        id: userId,
      })

      // Upsert envelopes
      if (backup.envelopes?.length > 0) {
        await supabase.from('envelopes').upsert(
          backup.envelopes.map((e) => ({ ...e, user_id: userId }))
        )
      }

      // Upsert transactions
      if (backup.transactions?.length > 0) {
        await supabase.from('transactions').upsert(
          backup.transactions.map((t) => ({ ...t, user_id: userId }))
        )
      }

      // Upsert transfers
      if (backup.transfers?.length > 0) {
        await supabase.from('transfers').upsert(
          backup.transfers.map((tr) => ({ ...tr, user_id: userId }))
        )
      }

      // Upsert deficit rules
      if (backup.deficit_rules?.length > 0) {
        await supabase.from('deficit_rules').upsert(
          backup.deficit_rules.map((r) => ({ ...r, user_id: userId }))
        )
      }

      return
    }

    // Local restore
    setLocalData('profile', { ...backup.profile, id: userId })
    setLocalData(
      'envelopes',
      backup.envelopes.map((e) => ({ ...e, user_id: userId }))
    )
    setLocalData(
      'transactions',
      backup.transactions.map((t) => ({ ...t, user_id: userId }))
    )
    setLocalData(
      'transfers',
      backup.transfers.map((tr) => ({ ...tr, user_id: userId }))
    )
    setLocalData(
      'deficit_rules',
      backup.deficit_rules?.map((r) => ({ ...r, user_id: userId })) || []
    )
  }
}
