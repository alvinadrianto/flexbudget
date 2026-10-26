import React, { useState } from 'react'
import {
  Wallet,
  Plus,
  PiggyBank,
  ShieldCheck,
  Calendar,
  Sparkles,
  Edit2,
} from 'lucide-react'
import { formatRupiah, parseRupiahInput } from '../services/financialEngine'
import type {
  DeficitCoverageMode,
  Envelope,
  EnvelopeBalanceInfo,
  EnvelopeType,
  PeriodType,
  RolloverPolicy,
} from '../types/finance'
import { useFinance } from '../context/FinanceContext'

interface EnvelopesViewProps {
  onOpenTransfer: (sourceId?: string | null, targetId?: string | null) => void
  onOpenDeficit: (info: EnvelopeBalanceInfo) => void
  onOpenRelease: (target: Envelope, pool: Envelope, poolBalance: number) => void
  onOpenSurplus: (info: EnvelopeBalanceInfo) => void
}

export const EnvelopesView: React.FC<EnvelopesViewProps> = ({
  onOpenTransfer,
  onOpenDeficit,
  onOpenRelease,
  onOpenSurplus,
}) => {
  const { summary, envelopes, saveEnvelope, loadInitialTemplate } = useFinance()
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<EnvelopeType>('spending_monthly')
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [periodAmountStr, setPeriodAmountStr] = useState('')
  const [fundingSourceId, setFundingSourceId] = useState<string>('')
  const [rolloverPolicy, setRolloverPolicy] = useState<RolloverPolicy>('roll_over')
  const [surplusDestinationId, setSurplusDestinationId] = useState<string>('')
  const [deficitMode, setDeficitMode] = useState<DeficitCoverageMode>('manual')
  const [minProtectedStr, setMinProtectedStr] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!summary) return null

  const openCreateModal = () => {
    setEditingEnvelope(null)
    setName('')
    setType('spending_monthly')
    setPeriodType('monthly')
    setPeriodAmountStr('')
    setFundingSourceId('')
    setRolloverPolicy('roll_over')
    setSurplusDestinationId('')
    setDeficitMode('manual')
    setMinProtectedStr('')
    setIsModalOpen(true)
  }

  const openEditModal = (env: Envelope) => {
    setEditingEnvelope(env)
    setName(env.name)
    setType(env.type)
    setPeriodType(env.period_type)
    setPeriodAmountStr(env.period_amount.toString())
    setFundingSourceId(env.funding_source_id || '')
    setRolloverPolicy(env.rollover_policy)
    setSurplusDestinationId(env.surplus_destination_id || '')
    setDeficitMode(env.deficit_coverage_mode)
    setMinProtectedStr(env.min_protected_balance.toString())
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setIsSubmitting(true)
      const envToSave: Envelope = {
        id: editingEnvelope?.id || (crypto.randomUUID ? crypto.randomUUID() : `env-${Date.now()}`),
        user_id: summary.envelopes[0]?.envelope.user_id || '00000000-0000-0000-0000-000000000001',
        name: name.trim(),
        type,
        period_type: periodType,
        period_amount: parseRupiahInput(periodAmountStr),
        funding_source_id: fundingSourceId || null,
        rollover_policy: rolloverPolicy,
        surplus_destination_id: surplusDestinationId || null,
        deficit_coverage_mode: deficitMode,
        deficit_priority: editingEnvelope?.deficit_priority || 10,
        min_protected_balance: parseRupiahInput(minProtectedStr),
        is_archived: false,
        sort_order: editingEnvelope?.sort_order || envelopes.length + 1,
      }

      await saveEnvelope(envToSave)
      setIsModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Categorize envelopes for display
  const allowanceEnvelopes = summary.envelopes.filter(
    (e) => e.envelope.type === 'spending_daily' || e.envelope.type === 'spending_weekly'
  )
  const monthlyEnvelopes = summary.envelopes.filter(
    (e) => e.envelope.type === 'spending_monthly' || e.envelope.type === 'spending_custom'
  )
  const savingsEnvelopes = summary.envelopes.filter(
    (e) => e.envelope.type === 'savings' || e.envelope.type === 'emergency_fund' || e.envelope.type === 'reserve'
  )
  const poolEnvelopes = summary.envelopes.filter((e) => e.envelope.type === 'funding_pool')

  const renderEnvelopeCard = (info: EnvelopeBalanceInfo) => {
    const { envelope: env, balance, spentAmount, isDeficit, deficitAmount, availableSurplus } = info
    const pool = envelopes.find((e) => e.id === env.funding_source_id)

    return (
      <div
        key={env.id}
        className={`p-5 rounded-3xl border transition-all ${
          isDeficit
            ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-950/30'
            : 'bg-slate-900 border-slate-800 shadow-xl'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">{env.name}</h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {env.period_type}
              </span>
            </div>
            {pool && (
              <p className="text-[11px] text-indigo-400 mt-0.5">
                Didanai dari: <strong>{pool.name}</strong>
              </p>
            )}
          </div>

          <button
            onClick={() => openEditModal(env)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Ubah Konfigurasi"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Balance and Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-slate-400">Saldo Amplop:</span>
            <span
              className={`text-xl font-extrabold font-mono ${
                isDeficit ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {formatRupiah(balance)}
            </span>
          </div>

          {/* Quick stats row */}
          <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
            <span>Terpakai: <strong className="text-slate-200 font-mono">{formatRupiah(spentAmount)}</strong></span>
            {env.period_amount > 0 && (
              <span>Target: <strong className="text-slate-200 font-mono">{formatRupiah(env.period_amount)}</strong></span>
            )}
          </div>

          {env.min_protected_balance > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded-xl">
              <ShieldCheck className="w-3.5 h-3.5" />
              Proteksi minimum {formatRupiah(env.min_protected_balance)}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
          {isDeficit ? (
            <button
              onClick={() => onOpenDeficit(info)}
              className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95"
            >
              Tutup Defisit ({formatRupiah(deficitAmount)})
            </button>
          ) : (
            <>
              {pool && (
                <button
                  onClick={() => {
                    const poolBal = summary.envelopes.find((b) => b.envelope.id === pool.id)?.balance || 0
                    onOpenRelease(env, pool, poolBal)
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold text-xs transition-colors"
                >
                  Rilis Alokasi
                </button>
              )}

              {availableSurplus > 0 && (
                <button
                  onClick={() => onOpenSurplus(info)}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-colors"
                >
                  Alihkan Surplus
                </button>
              )}

              <button
                onClick={() => onOpenTransfer(env.id, null)}
                className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
                title="Transfer ke amplop lain"
              >
                Transfer
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Amplop & Anggaran Fleksibel</h2>
          <p className="text-xs text-slate-400">
            Sistem amplop virtual tanpa risiko kehilangan saldo atau uang hilang ({envelopes.length} amplop aktif)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {envelopes.length === 0 && (
            <button
              onClick={loadInitialTemplate}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" /> Terapkan Template Rp3.800.000
            </button>
          )}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Buat Amplop Baru
          </button>
        </div>
      </div>

      {/* Group 1: Flexible Allowances (Daily & Weekly) */}
      {allowanceEnvelopes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Calendar className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Tunjangan Berulang (Harian & Mingguan)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allowanceEnvelopes.map(renderEnvelopeCard)}
          </div>
        </section>
      )}

      {/* Group 2: Monthly Spending Envelopes */}
      {monthlyEnvelopes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Wallet className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Anggaran Pengeluaran Bulanan
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthlyEnvelopes.map(renderEnvelopeCard)}
          </div>
        </section>
      )}

      {/* Group 3: Savings & Emergency Reserves */}
      {savingsEnvelopes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <PiggyBank className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Tabungan & Dana Darurat (Protected)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savingsEnvelopes.map(renderEnvelopeCard)}
          </div>
        </section>
      )}

      {/* Group 4: Funding Pools */}
      {poolEnvelopes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Pool Pendanaan (Funding Pools)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {poolEnvelopes.map(renderEnvelopeCard)}
          </div>
        </section>
      )}

      {/* Envelope Modal (Create or Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-4">
              {editingEnvelope ? 'Ubah Konfigurasi Amplop' : 'Buat Amplop Anggaran Baru'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nama Amplop</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Tabungan, Makanan Kucing, Jajan"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tipe Amplop</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="spending_monthly">Pengeluaran Bulanan</option>
                    <option value="spending_daily">Tunjangan Harian</option>
                    <option value="spending_weekly">Tunjangan Mingguan</option>
                    <option value="savings">Tabungan Utama</option>
                    <option value="emergency_fund">Dana Darurat</option>
                    <option value="funding_pool">Pool Pendanaan</option>
                    <option value="reserve">Cadangan Khusus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Periode</label>
                  <select
                    value={periodType}
                    onChange={(e) => setPeriodType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="monthly">Bulanan</option>
                    <option value="daily">Harian</option>
                    <option value="weekly">Mingguan</option>
                    <option value="custom">Kustom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Alokasi / Rilis per Periode (Rupiah)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={periodAmountStr ? new Intl.NumberFormat('id-ID').format(parseRupiahInput(periodAmountStr)) : ''}
                  onChange={(e) => setPeriodAmountStr(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Pool Sumber Pendanaan (Opsional)
                </label>
                <select
                  value={fundingSourceId}
                  onChange={(e) => setFundingSourceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="">-- Langsung Dari Alokasi Gaji / Bebas --</option>
                  {envelopes
                    .filter((e) => e.type === 'funding_pool' && e.id !== editingEnvelope?.id)
                    .map((pool) => (
                      <option key={pool.id} value={pool.id}>
                        {pool.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Saldo Proteksi Minimum
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={minProtectedStr ? new Intl.NumberFormat('id-ID').format(parseRupiahInput(minProtectedStr)) : ''}
                    onChange={(e) => setMinProtectedStr(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Mode Penutupan Defisit
                  </label>
                  <select
                    value={deficitMode}
                    onChange={(e) => setDeficitMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="manual">Manual Review</option>
                    <option value="auto">Otomatis Prioritas</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Amplop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
