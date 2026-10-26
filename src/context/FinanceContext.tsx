import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type {
  DeficitRule,
  Envelope,
  FinancialSummary,
  Profile,
  Transaction,
  Transfer,
} from '../types/finance'
import {
  coverDeficitAuto,
  coverDeficitManual,
  generateFinancialSummary,
  releasePoolAllowance,
  routeSurplusFunds,
} from '../services/financialEngine'
import { DataService } from '../services/dataService'
import { useAuth } from './AuthContext'

interface FinanceContextType {
  profile: Profile | null
  summary: FinancialSummary | null
  envelopes: Envelope[]
  transactions: Transaction[]
  transfers: Transfer[]
  deficitRules: DeficitRule[]
  isLoading: boolean
  isOffline: boolean
  addTransaction: (data: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Transaction>
  editTransaction: (tx: Transaction) => Promise<Transaction>
  removeTransaction: (id: string) => Promise<void>
  saveEnvelope: (env: Envelope) => Promise<Envelope>
  transferFunds: (sourceId: string | null, targetId: string | null, amount: number, description: string) => Promise<Transfer>
  releaseAllowance: (poolId: string, targetId: string, amount: number, periodKey: string) => Promise<{ success: boolean; error?: string }>
  routeSurplus: (sourceId: string, destinationId: string, amount: number, reason?: string) => Promise<{ success: boolean; error?: string }>
  coverDeficitManually: (deficitEnvelopeId: string, allocations: { sourceEnvelope: Envelope; availableFunds: number; amountToTake: number }[]) => Promise<{ success: boolean; error?: string; remainingDeficit?: number }>
  coverDeficitAutomatically: (deficitEnvelopeId: string) => Promise<{ success: boolean; summaryLog: string[]; remainingDeficit: number }>
  loadInitialTemplate: () => Promise<void>
  restoreFromBackup: (backup: any) => Promise<void>
  refreshData: () => Promise<void>
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined)

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [deficitRules, setDeficitRules] = useState<DeficitRule[]>([])
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setEnvelopes([])
      setTransactions([])
      setTransfers([])
      setDeficitRules([])
      setSummary(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const [prof, envs, txs, trs, rules] = await Promise.all([
        DataService.getProfile(user.id),
        DataService.getEnvelopes(user.id),
        DataService.getTransactions(user.id),
        DataService.getTransfers(user.id),
        DataService.getDeficitRules(user.id),
      ])

      setProfile(prof)
      setEnvelopes(envs)
      setTransactions(txs)
      setTransfers(trs)
      setDeficitRules(rules)

      const sum = generateFinancialSummary(prof, envs, txs, trs)
      setSummary(sum)
    } catch (err) {
      console.error('Gagal memuat data keuangan:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Recalculate summary whenever envelopes, txs, trs change
  const recalculate = (
    currentProf = profile,
    currentEnvs = envelopes,
    currentTxs = transactions,
    currentTrs = transfers
  ) => {
    if (!currentProf) return
    const sum = generateFinancialSummary(currentProf, currentEnvs, currentTxs, currentTrs)
    setSummary(sum)
  }

  const addTransaction = async (
    data: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<Transaction> => {
    if (!user) throw new Error('Pengguna tidak terotentikasi')

    const newTx: Transaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random()}`,
      user_id: user.id,
      ...data,
      amount: Math.max(0, Math.round(data.amount)),
      created_at: new Date().toISOString(),
    }

    const saved = await DataService.saveTransaction(newTx)
    const updatedTxs = [saved, ...transactions]
    setTransactions(updatedTxs)
    recalculate(profile, envelopes, updatedTxs, transfers)
    return saved
  }

  const editTransaction = async (tx: Transaction): Promise<Transaction> => {
    if (!user) throw new Error('Pengguna tidak terotentikasi')

    const cleanedTx: Transaction = {
      ...tx,
      amount: Math.max(0, Math.round(tx.amount)),
      updated_at: new Date().toISOString(),
    }

    const saved = await DataService.saveTransaction(cleanedTx)
    const updatedTxs = transactions.map((t) => (t.id === saved.id ? saved : t))
    setTransactions(updatedTxs)
    recalculate(profile, envelopes, updatedTxs, transfers)
    return saved
  }

  const removeTransaction = async (id: string): Promise<void> => {
    if (!user) throw new Error('Pengguna tidak terotentikasi')

    await DataService.deleteTransaction(id, user.id)
    const updatedTxs = transactions.filter((t) => t.id !== id)
    setTransactions(updatedTxs)
    recalculate(profile, envelopes, updatedTxs, transfers)
  }

  const saveEnvelope = async (env: Envelope): Promise<Envelope> => {
    if (!user) throw new Error('Pengguna tidak terotentikasi')

    const saved = await DataService.saveEnvelope(env)
    const exists = envelopes.some((e) => e.id === saved.id)
    const updatedEnvs = exists
      ? envelopes.map((e) => (e.id === saved.id ? saved : e))
      : [...envelopes, saved]

    setEnvelopes(updatedEnvs)
    recalculate(profile, updatedEnvs, transactions, transfers)
    return saved
  }

  const transferFunds = async (
    sourceId: string | null,
    targetId: string | null,
    amount: number,
    description: string
  ): Promise<Transfer> => {
    if (!user) throw new Error('Pengguna tidak terotentikasi')

    const newTr: Transfer = {
      id: crypto.randomUUID ? crypto.randomUUID() : `tr-${Date.now()}-${Math.random()}`,
      user_id: user.id,
      type: 'manual_transfer',
      source_envelope_id: sourceId,
      destination_envelope_id: targetId,
      amount: Math.max(0, Math.round(amount)),
      description,
      created_at: new Date().toISOString(),
    }

    const [saved] = await DataService.saveTransfers([newTr])
    const updatedTrs = [saved, ...transfers]
    setTransfers(updatedTrs)
    recalculate(profile, envelopes, transactions, updatedTrs)
    return saved
  }

  const releaseAllowance = async (
    poolId: string,
    targetId: string,
    amount: number,
    periodKey: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user || !summary) return { success: false, error: 'Tidak ada sesi aktif' }

    const poolEnv = envelopes.find((e) => e.id === poolId)
    const targetEnv = envelopes.find((e) => e.id === targetId)

    if (!poolEnv || !targetEnv) {
      return { success: false, error: 'Amplop pool atau target tidak ditemukan.' }
    }

    const poolBal = summary.envelopes.find((e) => e.envelope.id === poolId)?.balance || 0

    const result = releasePoolAllowance({
      userId: user.id,
      poolEnvelope: poolEnv,
      targetEnvelope: targetEnv,
      amount,
      periodKey,
      currentPoolBalance: poolBal,
      existingTransfers: transfers,
    })

    if (!result.success || !result.transfer) {
      return { success: false, error: result.error }
    }

    const [saved] = await DataService.saveTransfers([result.transfer])
    const updatedTrs = [saved, ...transfers]
    setTransfers(updatedTrs)
    recalculate(profile, envelopes, transactions, updatedTrs)
    return { success: true }
  }

  const routeSurplus = async (
    sourceId: string,
    destinationId: string,
    amount: number,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user || !summary) return { success: false, error: 'Tidak ada sesi aktif' }

    const sourceEnv = envelopes.find((e) => e.id === sourceId)
    const destEnv = envelopes.find((e) => e.id === destinationId)

    if (!sourceEnv || !destEnv) {
      return { success: false, error: 'Amplop sumber atau tujuan tidak ditemukan.' }
    }

    const sourceInfo = summary.envelopes.find((e) => e.envelope.id === sourceId)
    const available = sourceInfo?.availableSurplus || 0

    const result = routeSurplusFunds({
      userId: user.id,
      sourceEnvelope: sourceEnv,
      destinationEnvelope: destEnv,
      amount,
      availableSurplus: available,
      reason,
    })

    if (!result.success || !result.transfer) {
      return { success: false, error: result.error }
    }

    const [saved] = await DataService.saveTransfers([result.transfer])
    const updatedTrs = [saved, ...transfers]
    setTransfers(updatedTrs)
    recalculate(profile, envelopes, transactions, updatedTrs)
    return { success: true }
  }

  const coverDeficitManually = async (
    deficitEnvelopeId: string,
    allocations: { sourceEnvelope: Envelope; availableFunds: number; amountToTake: number }[]
  ): Promise<{ success: boolean; error?: string; remainingDeficit?: number }> => {
    if (!user || !summary) return { success: false, error: 'Tidak ada sesi aktif' }

    const deficitInfo = summary.envelopes.find((e) => e.envelope.id === deficitEnvelopeId)
    if (!deficitInfo || !deficitInfo.isDeficit) {
      return { success: false, error: 'Amplop ini tidak mengalami defisit.' }
    }

    const result = coverDeficitManual({
      userId: user.id,
      deficitEnvelopeId,
      deficitAmount: deficitInfo.deficitAmount,
      allocations,
    })

    if (!result.success || result.transfers.length === 0) {
      return { success: false, error: result.error }
    }

    const saved = await DataService.saveTransfers(result.transfers)
    const updatedTrs = [...saved, ...transfers]
    setTransfers(updatedTrs)
    recalculate(profile, envelopes, transactions, updatedTrs)

    return {
      success: true,
      remainingDeficit: result.remainingDeficit,
    }
  }

  const coverDeficitAutomatically = async (
    deficitEnvelopeId: string
  ): Promise<{ success: boolean; summaryLog: string[]; remainingDeficit: number }> => {
    if (!user || !summary) {
      return { success: false, summaryLog: ['Tidak ada sesi pengguna'], remainingDeficit: 0 }
    }

    const deficitInfo = summary.envelopes.find((e) => e.envelope.id === deficitEnvelopeId)
    if (!deficitInfo || !deficitInfo.isDeficit) {
      return { success: false, summaryLog: ['Amplop tidak dalam kondisi defisit'], remainingDeficit: 0 }
    }

    const result = coverDeficitAuto({
      userId: user.id,
      deficitEnvelope: deficitInfo.envelope,
      deficitAmount: deficitInfo.deficitAmount,
      envelopeBalances: summary.envelopes,
      rules: deficitRules,
    })

    if (result.success && result.transfers.length > 0) {
      const saved = await DataService.saveTransfers(result.transfers)
      const updatedTrs = [...saved, ...transfers]
      setTransfers(updatedTrs)
      recalculate(profile, envelopes, transactions, updatedTrs)
    }

    return {
      success: result.success,
      summaryLog: result.summaryLog,
      remainingDeficit: result.remainingDeficit,
    }
  }

  const loadInitialTemplate = async (): Promise<void> => {
    if (!user) return
    setIsLoading(true)
    try {
      const { envelopes: newEnvs, transfers: newTrs } = await DataService.applyInitialTemplate(user.id)
      setEnvelopes(newEnvs)
      setTransfers(newTrs)
      recalculate(profile, newEnvs, transactions, newTrs)
    } finally {
      setIsLoading(false)
    }
  }

  const restoreFromBackup = async (backup: any): Promise<void> => {
    if (!user) return
    setIsLoading(true)
    try {
      await DataService.restoreBackup(backup, user.id)
      await loadData()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <FinanceContext.Provider
      value={{
        profile,
        summary,
        envelopes,
        transactions,
        transfers,
        deficitRules,
        isLoading,
        isOffline,
        addTransaction,
        editTransaction,
        removeTransaction,
        saveEnvelope,
        transferFunds,
        releaseAllowance,
        routeSurplus,
        coverDeficitManually,
        coverDeficitAutomatically,
        loadInitialTemplate,
        restoreFromBackup,
        refreshData: loadData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  )
}

export const useFinance = () => {
  const context = useContext(FinanceContext)
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider')
  }
  return context
}
