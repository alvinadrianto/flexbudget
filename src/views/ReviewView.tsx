import React, { useState } from 'react'
import { CheckCircle2, PiggyBank } from 'lucide-react'
import { formatRupiah, getJakartaDateStrings } from '../services/financialEngine'
import type { EnvelopeBalanceInfo, PeriodType } from '../types/finance'
import { useFinance } from '../context/FinanceContext'

interface ReviewViewProps {
  onOpenSurplus: (sourceInfo: EnvelopeBalanceInfo) => void
  onOpenDeficit: (envelopeInfo: EnvelopeBalanceInfo) => void
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  onOpenSurplus,
  onOpenDeficit,
}) => {
  const { summary } = useFinance()
  const [activeTab, setActiveTab] = useState<PeriodType>('daily')

  if (!summary) return null

  const jakarta = getJakartaDateStrings()

  // Filter envelopes matching current period review
  const envelopesInScope = summary.envelopes.filter((e) => {
    if (activeTab === 'daily') return e.envelope.period_type === 'daily'
    if (activeTab === 'weekly') return e.envelope.period_type === 'weekly'
    return e.envelope.period_type === 'monthly'
  })

  const totalSpent = envelopesInScope.reduce((sum, e) => sum + e.spentAmount, 0)
  const totalSurplus = envelopesInScope.reduce((sum, e) => sum + e.availableSurplus, 0)
  const totalDeficit = envelopesInScope.reduce((sum, e) => sum + e.deficitAmount, 0)

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white">Tinjauan & Tutup Periode</h2>
        <p className="text-xs text-slate-400">
          Evaluasi anggaran berkala, alihkan surplus ke tabungan, dan pastikan defisit terselesaikan
        </p>
      </div>

      {/* Period Switcher Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('daily')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'daily'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Harian ({jakarta.todayStr})
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'weekly'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Mingguan (Mulai {jakarta.weekStartStr})
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'monthly'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Bulanan ({jakarta.todayStr.slice(0, 7)})
        </button>
      </div>

      {/* Summary Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <span className="text-xs text-slate-400 block mb-1">Total Terpakai di Periode Ini</span>
          <span className="text-2xl font-bold font-mono text-white">
            {formatRupiah(totalSpent)}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <span className="text-xs text-slate-400 block mb-1">Total Surplus yang Dapat Dialihkan</span>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {formatRupiah(totalSurplus)}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <span className="text-xs text-slate-400 block mb-1">Total Defisit Belum Tertutup</span>
          <span className={`text-2xl font-bold font-mono ${totalDeficit > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {formatRupiah(totalDeficit)}
          </span>
        </div>
      </div>

      {/* Envelopes In Scope Review Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Rincian Amplop Periode {activeTab === 'daily' ? 'Harian' : activeTab === 'weekly' ? 'Mingguan' : 'Bulanan'}
        </h3>

        {envelopesInScope.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
            Tidak ada amplop dengan tipe periode ini. Buat amplop baru di menu Amplop.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {envelopesInScope.map((info) => {
              const { envelope: env, balance, spentAmount, isDeficit, deficitAmount, availableSurplus } = info

              return (
                <div
                  key={env.id}
                  className={`p-5 rounded-3xl border transition-all ${
                    isDeficit
                      ? 'bg-rose-950/20 border-rose-500/40 shadow-xl'
                      : 'bg-slate-900 border-slate-800 shadow-xl'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-white">{env.name}</h4>
                      <p className="text-xs text-slate-400">
                        Target Periode: <strong className="font-mono text-slate-200">{formatRupiah(env.period_amount)}</strong>
                      </p>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                        isDeficit
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : balance === 0
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isDeficit ? 'Defisit' : balance === 0 ? 'Habis Tepat' : 'Surplus'}
                    </span>
                  </div>

                  <div className="mt-4 p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Pengeluaran Tercatat:</span>
                      <span className="font-mono text-white font-bold">{formatRupiah(spentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Sisa Saldo:</span>
                      <span
                        className={`font-mono font-bold ${
                          isDeficit ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatRupiah(balance)}
                      </span>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    {isDeficit ? (
                      <button
                        onClick={() => onOpenDeficit(info)}
                        className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95"
                      >
                        Tutup Defisit ({formatRupiah(deficitAmount)})
                      </button>
                    ) : availableSurplus > 0 ? (
                      <button
                        onClick={() => onOpenSurplus(info)}
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <PiggyBank className="w-4 h-4" /> Alihkan Surplus ({formatRupiah(availableSurplus)})
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Anggaran Selesai Seimbang
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
