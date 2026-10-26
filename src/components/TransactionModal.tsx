import React, { useState, useEffect } from 'react'
import { X, ArrowDownRight, ArrowUpRight, AlertTriangle, AlertCircle, ArrowLeft } from 'lucide-react'
import type { Envelope, EnvelopeBalanceInfo, Transaction, TransactionType } from '../types/finance'
import { formatRupiah, getJakartaDateStrings, parseRupiahInput } from '../services/financialEngine'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (tx: {
    type: TransactionType
    amount: number
    date: string
    envelope_id: string | null
    description: string
    notes?: string
  }) => Promise<void>
  initialType?: TransactionType
  initialTransaction?: Transaction | null
  envelopes: Envelope[]
  envelopeBalances?: EnvelopeBalanceInfo[]
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialType = 'expense',
  initialTransaction = null,
  envelopes,
  envelopeBalances = [],
}) => {
  const [type, setType] = useState<TransactionType>(initialType)
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(getJakartaDateStrings().todayStr)
  const [envelopeId, setEnvelopeId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeficitWarning, setShowDeficitWarning] = useState(false)

  useEffect(() => {
    if (initialTransaction) {
      setType(initialTransaction.type)
      setAmountStr(initialTransaction.amount.toString())
      setDate(initialTransaction.date)
      setEnvelopeId(initialTransaction.envelope_id || '')
      setDescription(initialTransaction.description)
      setNotes(initialTransaction.notes || '')
    } else {
      setType(initialType)
      setAmountStr('')
      setDate(getJakartaDateStrings().todayStr)
      // Pick first non-pool envelope as default for expense
      const defaultEnv = envelopes.find((e) => e.type !== 'funding_pool')
      setEnvelopeId(defaultEnv ? defaultEnv.id : '')
      setDescription('')
      setNotes('')
    }
    setError(null)
    setShowDeficitWarning(false)
  }, [isOpen, initialType, initialTransaction, envelopes])

  if (!isOpen) return null

  const parsedAmount = parseRupiahInput(amountStr)

  // Find balance info for the selected envelope
  const selectedBalanceInfo = envelopeBalances.find((b) => b.envelope.id === envelopeId)
  const selectedEnvelope = envelopes.find((e) => e.id === envelopeId)

  // If editing an existing transaction that was already charged to this envelope,
  // add back its current recorded amount to determine effective available balance before this edit.
  const isEditingThisEnvelopeExpense =
    Boolean(initialTransaction) &&
    initialTransaction?.type === 'expense' &&
    initialTransaction?.envelope_id === envelopeId

  const effectiveCurrentBalance =
    (selectedBalanceInfo ? selectedBalanceInfo.balance : 0) +
    (isEditingThisEnvelopeExpense ? initialTransaction?.amount || 0 : 0)

  const projectedBalance = effectiveCurrentBalance - parsedAmount
  const isWillDeficit = type === 'expense' && Boolean(envelopeId) && parsedAmount > 0 && projectedBalance < 0
  const deficitShortage = Math.abs(projectedBalance)

  const executeSave = async () => {
    try {
      setIsSubmitting(true)
      await onSave({
        type,
        amount: parsedAmount,
        date,
        envelope_id: type === 'expense' ? envelopeId : null,
        description: description.trim(),
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan transaksi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (parsedAmount <= 0) {
      setError('Nominal harus lebih dari Rp0.')
      return
    }

    if (!description.trim()) {
      setError('Deskripsi transaksi wajib diisi.')
      return
    }

    if (type === 'expense' && !envelopeId) {
      setError('Pengeluaran harus dialokasikan ke salah satu amplop anggaran.')
      return
    }

    // Intercept if this expense will cause the envelope to become deficit (minus)
    if (type === 'expense' && isWillDeficit && !showDeficitWarning) {
      setShowDeficitWarning(true)
      return
    }

    await executeSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            {showDeficitWarning && (
              <button
                type="button"
                onClick={() => setShowDeficitWarning(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Kembali ke formulir"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-bold text-white">
              {showDeficitWarning
                ? 'Konfirmasi Defisit Anggaran'
                : initialTransaction
                ? 'Ubah Transaksi'
                : 'Catat Transaksi'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* DEFICIT WARNING CONFIRMATION SCREEN */}
        {showDeficitWarning ? (
          <div className="mt-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Saldo Amplop Tidak Cukup!</h3>
                  <p className="text-xs text-amber-300">
                    Kekurangan dana: <strong className="font-mono">{formatRupiah(deficitShortage)}</strong>
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Amplop Tujuan:</span>
                  <span className="font-bold text-white">{selectedEnvelope?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Saldo Tersedia Saat Ini:</span>
                  <span className={`font-mono font-bold ${effectiveCurrentBalance < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {formatRupiah(effectiveCurrentBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Nominal Pengeluaran:</span>
                  <span className="font-mono font-bold text-rose-400">
                    -{formatRupiah(parsedAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <span className="text-slate-300 font-semibold">Hasil Saldo Amplop:</span>
                  <span className="font-mono font-extrabold text-rose-400 text-sm">
                    {formatRupiah(projectedBalance)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                Pengeluaran ini akan membuat amplop <strong>{selectedEnvelope?.name}</strong> berstatus <span className="text-rose-400 font-semibold">Defisit (Minus)</span>. Anda dapat menutup kekurangan ini nanti via tombol <em>Tutup Defisit</em>, atau batalkan jika tidak sengaja.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeficitWarning(false)}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors text-center"
              >
                Cek Kembali / Batal
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98] disabled:opacity-50 text-center"
              >
                {isSubmitting ? 'Menyimpan...' : 'Abaikan & Catat Defisit'}
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors underline"
              >
                Batalkan dan Tutup Form
              </button>
            </div>
          </div>
        ) : (
          /* REGULAR TRANSACTION FORM */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Transaction Type Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setType('expense')
                  setShowDeficitWarning(false)
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  type === 'expense'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income')
                  setShowDeficitWarning(false)
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  type === 'income'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                Pemasukan
              </button>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nominal (Rupiah)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={amountStr ? new Intl.NumberFormat('id-ID').format(parsedAmount) : ''}
                  onChange={(e) => {
                    setAmountStr(e.target.value)
                    setShowDeficitWarning(false)
                  }}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-11 pr-4 py-3 text-lg font-bold font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Real-time Deficit Warning Preview */}
              {isWillDeficit && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Perhatian: Saldo Amplop Kurang</span>
                    <span className="text-[11px] text-amber-300/90">
                      Saldo saat ini {formatRupiah(effectiveCurrentBalance)}. Pengeluaran ini akan defisit {formatRupiah(deficitShortage)}.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Envelope Selection (for Expense) */}
            {type === 'expense' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-400">
                    Amplop Anggaran
                  </label>
                  {selectedBalanceInfo && (
                    <span className={`text-[11px] font-mono font-semibold ${
                      effectiveCurrentBalance < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      Saldo: {formatRupiah(effectiveCurrentBalance)}
                    </span>
                  )}
                </div>
                <select
                  value={envelopeId}
                  onChange={(e) => {
                    setEnvelopeId(e.target.value)
                    setShowDeficitWarning(false)
                  }}
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
                >
                  <option value="">-- Pilih Amplop Anggaran --</option>
                  {envelopes.map((env) => {
                    const bInfo = envelopeBalances.find((b) => b.envelope.id === env.id)
                    const balDisplay = bInfo !== undefined ? ` (Saldo: ${formatRupiah(bInfo.balance)})` : ''
                    return (
                      <option key={env.id} value={env.id}>
                        {env.name}{balDisplay}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Deskripsi
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Makan siang, Bensin, Gaji"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Tanggal Transaksi
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan struk, nomor referensi, dll."
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] ${
                  type === 'expense'
                    ? isWillDeficit
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                } disabled:opacity-50`}
              >
                {isSubmitting
                  ? 'Menyimpan...'
                  : isWillDeficit
                  ? 'Lanjut & Cek Peringatan Defisit'
                  : initialTransaction
                  ? 'Simpan Perubahan'
                  : 'Catat Transaksi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
