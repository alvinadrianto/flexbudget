import React, { useState } from 'react'
import { X, Sparkles, CheckCircle2 } from 'lucide-react'
import type { Envelope } from '../types/finance'
import { formatRupiah, getJakartaDateStrings } from '../services/financialEngine'

interface ReleaseModalProps {
  isOpen: boolean
  onClose: () => void
  targetEnvelope: Envelope | null
  poolEnvelope: Envelope | null
  poolBalance: number
  onRelease: (poolId: string, targetId: string, amount: number, periodKey: string) => Promise<{ success: boolean; error?: string }>
}

export const ReleaseModal: React.FC<ReleaseModalProps> = ({
  isOpen,
  onClose,
  targetEnvelope,
  poolEnvelope,
  poolBalance,
  onRelease,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen || !targetEnvelope || !poolEnvelope) return null

  const releaseAmount = targetEnvelope.period_amount
  const hasEnoughFunds = poolBalance >= releaseAmount
  const shortage = Math.max(0, releaseAmount - poolBalance)

  const dateStrings = getJakartaDateStrings()
  const periodKey =
    targetEnvelope.period_type === 'daily'
      ? `release:daily:${dateStrings.todayStr}:${targetEnvelope.id}`
      : `release:weekly:${dateStrings.weekStartStr}:${targetEnvelope.id}`

  const handleConfirm = async () => {
    setError(null)
    setSuccessMsg(null)
    try {
      setIsSubmitting(true)
      const res = await onRelease(poolEnvelope.id, targetEnvelope.id, releaseAmount, periodKey)
      if (!res.success) {
        setError(res.error || 'Gagal merilis alokasi.')
      } else {
        setSuccessMsg(`Berhasil merilis ${formatRupiah(releaseAmount)} ke ${targetEnvelope.name}!`)
        setTimeout(() => {
          onClose()
        }, 1200)
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
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Rilis Tunjangan {targetEnvelope.name}</h2>
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

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {successMsg}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Sesuai aturan alokasi fleksibel, tunjangan ini akan ditarik dari pool sumber{' '}
            <strong className="text-slate-200">{poolEnvelope.name}</strong> tanpa mengubah saldo total uang Anda.
          </p>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Pool Sumber:</span>
              <span className="font-semibold text-white">{poolEnvelope.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Saldo Pool Tersedia:</span>
              <span className="font-mono font-bold text-emerald-400">{formatRupiah(poolBalance)}</span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-slate-800/60">
              <span className="text-slate-400">Nominal Dirilis:</span>
              <span className="font-mono font-bold text-indigo-300 text-sm">
                {formatRupiah(releaseAmount)}
              </span>
            </div>
          </div>

          {!hasEnoughFunds && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              Saldo di pool sumber tidak mencukupi untuk rilis penuh (kurang {formatRupiah(shortage)}).
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || !hasEnoughFunds || !!successMsg}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses Rilis...' : 'Rilis Tunjangan Sekarang'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
