import React, { useState, useEffect } from 'react'
import { X, Sparkles, CheckCircle2, Clock, PlusCircle } from 'lucide-react'
import type { Envelope, Transfer } from '../types/finance'
import { formatRupiah, checkAllowanceStatus } from '../services/financialEngine'

interface ReleaseModalProps {
  isOpen: boolean
  onClose: () => void
  targetEnvelope: Envelope | null
  poolEnvelope: Envelope | null
  poolBalance: number
  transfers: Transfer[]
  onRelease: (
    poolId: string,
    targetId: string,
    amount: number,
    periodKey: string
  ) => Promise<{ success: boolean; error?: string }>
}

export const ReleaseModal: React.FC<ReleaseModalProps> = ({
  isOpen,
  onClose,
  targetEnvelope,
  poolEnvelope,
  poolBalance,
  transfers,
  onRelease,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isExtraRelease, setIsExtraRelease] = useState(false)

  // Critical fix: Reset state whenever modal opens or target envelope changes
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false)
      setError(null)
      setSuccessMsg(null)
      setIsExtraRelease(false)
    }
  }, [isOpen, targetEnvelope?.id])

  if (!isOpen || !targetEnvelope || !poolEnvelope) return null

  const releaseAmount = targetEnvelope.period_amount
  const hasEnoughFunds = poolBalance >= releaseAmount
  const shortage = Math.max(0, releaseAmount - poolBalance)

  const isDaily = targetEnvelope.period_type === 'daily'
  const isWeekly = targetEnvelope.period_type === 'weekly'

  const allowanceStatus =
    isDaily || isWeekly
      ? checkAllowanceStatus(targetEnvelope.id, isDaily ? 'daily' : 'weekly', transfers)
      : null

  const alreadyReleased = Boolean(allowanceStatus?.isReleased)

  // Determine period key (if extra release requested, append unique timestamp)
  const periodKey = isExtraRelease
    ? `${allowanceStatus?.currentPeriodKey}:extra-${Date.now()}`
    : (allowanceStatus?.currentPeriodKey || `release:${targetEnvelope.period_type}:${Date.now()}:${targetEnvelope.id}`)

  const handleConfirm = async () => {
    setError(null)
    setSuccessMsg(null)
    try {
      setIsSubmitting(true)
      const res = await onRelease(poolEnvelope.id, targetEnvelope.id, releaseAmount, periodKey)
      if (!res.success) {
        setError(res.error || 'Gagal merilis alokasi.')
      } else {
        setSuccessMsg(
          `Berhasil merilis ${formatRupiah(releaseAmount)} ke ${targetEnvelope.name}!`
        )
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
            <div>
              <h2 className="text-base font-bold text-white">Rilis Tunjangan {targetEnvelope.name}</h2>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                Periode {targetEnvelope.period_type}
              </span>
            </div>
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
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {/* Status banner when already released */}
          {alreadyReleased && !successMsg && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Tunjangan {allowanceStatus?.periodLabel} Sudah Pernah Dirilis</span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{allowanceStatus?.nextResetDescription}</span>
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            Tunjangan ini ditarik dari pool sumber{' '}
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

          {/* Option to release extra allowance if already released */}
          {alreadyReleased && (
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Perlu dana tambahan?</span>
                <span className="text-[11px] text-slate-400">Cairkan ekstra di luar jadwal rutin</span>
              </div>
              <button
                type="button"
                onClick={() => setIsExtraRelease(!isExtraRelease)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isExtraRelease
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20'
                }`}
              >
                {isExtraRelease ? 'Mode Ekstra Aktif' : '+ Rilis Ekstra'}
              </button>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleConfirm}
              disabled={
                isSubmitting ||
                !hasEnoughFunds ||
                Boolean(successMsg) ||
                (alreadyReleased && !isExtraRelease)
              }
              className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${
                isExtraRelease
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30'
              }`}
            >
              {isSubmitting ? (
                'Memproses Rilis...'
              ) : alreadyReleased && !isExtraRelease ? (
                `Sudah Dirilis untuk ${allowanceStatus?.periodLabel}`
              ) : isExtraRelease ? (
                <>
                  <PlusCircle className="w-4 h-4" />
                  Rilis Tunjangan Tambahan ({formatRupiah(releaseAmount)})
                </>
              ) : (
                'Rilis Tunjangan Sekarang'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
