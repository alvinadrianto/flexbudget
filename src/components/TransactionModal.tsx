import React, { useState, useEffect } from 'react'
import { X, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { Envelope, Transaction, TransactionType } from '../types/finance'
import { getJakartaDateStrings, parseRupiahInput } from '../services/financialEngine'

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
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialType = 'expense',
  initialTransaction = null,
  envelopes,
}) => {
  const [type, setType] = useState<TransactionType>(initialType)
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(getJakartaDateStrings().todayStr)
  const [envelopeId, setEnvelopeId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  }, [isOpen, initialType, initialTransaction, envelopes])

  if (!isOpen) return null

  const parsedAmount = parseRupiahInput(amountStr)

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <h2 className="text-lg font-bold text-white">
            {initialTransaction ? 'Ubah Transaksi' : 'Catat Transaksi'}
          </h2>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Transaction Type Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setType('expense')}
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
              onClick={() => setType('income')}
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
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-11 pr-4 py-3 text-lg font-bold font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Envelope Selection (for Expense) */}
          {type === 'expense' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Amplop Anggaran
              </label>
              <select
                value={envelopeId}
                onChange={(e) => setEnvelopeId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
              >
                <option value="">-- Pilih Amplop Anggaran --</option>
                {envelopes.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name} ({env.type})
                  </option>
                ))}
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
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              } disabled:opacity-50`}
            >
              {isSubmitting ? 'Menyimpan...' : initialTransaction ? 'Simpan Perubahan' : 'Catat Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
