import React, { useState, useEffect } from 'react'
import { X, ArrowRightLeft } from 'lucide-react'
import type { Envelope, EnvelopeBalanceInfo } from '../types/finance'
import { formatRupiah, parseRupiahInput } from '../services/financialEngine'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  onTransfer: (sourceId: string | null, targetId: string | null, amount: number, description: string) => Promise<void>
  envelopes: Envelope[]
  envelopeBalances: EnvelopeBalanceInfo[]
  unallocatedCash: number
  defaultSourceId?: string | null
  defaultTargetId?: string | null
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  onTransfer,
  envelopes,
  envelopeBalances,
  unallocatedCash,
  defaultSourceId = null,
  defaultTargetId = null,
}) => {
  const [sourceId, setSourceId] = useState<string>(defaultSourceId || '')
  const [targetId, setTargetId] = useState<string>(defaultTargetId || '')
  const [amountStr, setAmountStr] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSourceId(defaultSourceId || '')
    setTargetId(defaultTargetId || '')
    setAmountStr('')
    setDescription('')
    setError(null)
  }, [isOpen, defaultSourceId, defaultTargetId])

  if (!isOpen) return null

  const parsedAmount = parseRupiahInput(amountStr)

  // Find source available funds
  let sourceAvailable = 0
  if (!sourceId) {
    sourceAvailable = unallocatedCash
  } else {
    const info = envelopeBalances.find((e) => e.envelope.id === sourceId)
    sourceAvailable = info ? info.balance : 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (sourceId === targetId) {
      setError('Amplop sumber dan tujuan tidak boleh sama.')
      return
    }

    if (parsedAmount <= 0) {
      setError('Nominal transfer harus lebih dari Rp0.')
      return
    }

    if (parsedAmount > sourceAvailable) {
      setError(`Dana tidak mencukupi di sumber (tersedia ${formatRupiah(sourceAvailable)}).`)
      return
    }

    try {
      setIsSubmitting(true)
      const sourceEnvName = sourceId ? envelopes.find((e) => e.id === sourceId)?.name : 'Saldo Bebas'
      const targetEnvName = targetId ? envelopes.find((e) => e.id === targetId)?.name : 'Saldo Bebas'

      const desc = description.trim() || `Transfer dari ${sourceEnvName} ke ${targetEnvName}`

      await onTransfer(sourceId || null, targetId || null, parsedAmount, desc)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal melakukan transfer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Transfer Antar Amplop</h2>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Source Envelope */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-400">Amplop Sumber</label>
              <span className="text-[11px] font-mono text-slate-400">
                Tersedia:{' '}
                <strong className={sourceAvailable < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {formatRupiah(sourceAvailable)}
                </strong>
              </span>
            </div>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
            >
              <option value="">Saldo Bebas (Unallocated Cash)</option>
              {envelopes.map((env) => {
                const bal = envelopeBalances.find((b) => b.envelope.id === env.id)?.balance || 0
                return (
                  <option key={env.id} value={env.id}>
                    {env.name} ({formatRupiah(bal)})
                  </option>
                )
              })}
            </select>
          </div>

          {/* Destination Envelope */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Amplop Tujuan
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
            >
              <option value="">Saldo Bebas (Kembalikan ke Unallocated)</option>
              {envelopes.map((env) => {
                const bal = envelopeBalances.find((b) => b.envelope.id === env.id)?.balance || 0
                return (
                  <option key={env.id} value={env.id}>
                    {env.name} ({formatRupiah(bal)})
                  </option>
                )
              })}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Nominal Transfer (Rupiah)
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

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Keterangan (Opsional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Alokasi bulanan, Menutup kekurangan"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses Transfer...' : 'Konfirmasi Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
