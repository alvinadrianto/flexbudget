import React, { useState, useEffect } from 'react'
import { X, PiggyBank } from 'lucide-react'
import type { Envelope, EnvelopeBalanceInfo } from '../types/finance'
import { formatRupiah, parseRupiahInput } from '../services/financialEngine'

interface SurplusModalProps {
  isOpen: boolean
  onClose: () => void
  sourceInfo: EnvelopeBalanceInfo | null
  allEnvelopes: Envelope[]
  onRouteSurplus: (sourceId: string, destinationId: string, amount: number, reason?: string) => Promise<{ success: boolean; error?: string }>
}

export const SurplusModal: React.FC<SurplusModalProps> = ({
  isOpen,
  onClose,
  sourceInfo,
  allEnvelopes,
  onRouteSurplus,
}) => {
  const [destinationId, setDestinationId] = useState<string>('')
  const [amountStr, setAmountStr] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sourceInfo) {
      // Pick savings or emergency fund as default destination
      const defaultDest =
        allEnvelopes.find((e) => e.type === 'emergency_fund' || e.type === 'savings') ||
        allEnvelopes.find((e) => e.id !== sourceInfo.envelope.id)

      setDestinationId(defaultDest ? defaultDest.id : '')
      setAmountStr(sourceInfo.availableSurplus > 0 ? sourceInfo.availableSurplus.toString() : '')
      setReason(`Pengalihan sisa saldo dari ${sourceInfo.envelope.name}`)
    }
    setError(null)
  }, [isOpen, sourceInfo, allEnvelopes])

  if (!isOpen || !sourceInfo) return null

  const parsedAmount = parseRupiahInput(amountStr)
  const availableSurplus = sourceInfo.availableSurplus
  const sourceEnv = sourceInfo.envelope

  const eligibleDestinations = allEnvelopes.filter((e) => e.id !== sourceEnv.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!destinationId) {
      setError('Pilih amplop tujuan pengalihan surplus.')
      return
    }

    if (parsedAmount <= 0) {
      setError('Nominal surplus harus lebih dari Rp0.')
      return
    }

    if (parsedAmount > availableSurplus) {
      setError(`Surplus yang dapat dialihkan maksimal ${formatRupiah(availableSurplus)}.`)
      return
    }

    try {
      setIsSubmitting(true)
      const res = await onRouteSurplus(sourceEnv.id, destinationId, parsedAmount, reason.trim())
      if (!res.success) {
        setError(res.error || 'Gagal mengalihkan surplus.')
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <PiggyBank className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Alihkan Surplus / Sisa Dana</h2>
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
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Amplop Asal:</span>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-white">{sourceEnv.name}</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Surplus: {formatRupiah(availableSurplus)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Pindahkan Ke Amplop Tujuan
            </label>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
            >
              <option value="">-- Pilih Amplop Tujuan --</option>
              {eligibleDestinations.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.type === 'savings' ? 'Tabungan' : env.type === 'emergency_fund' ? 'Dana Darurat' : env.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Nominal yang Dialihkan (Rupiah)
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

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Alasan / Keterangan
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || availableSurplus <= 0}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Mengalihkan Surplus...' : 'Simpan ke Cadangan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
