import React from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  ArrowRightLeft,
} from 'lucide-react'
import { formatRupiah } from '../services/financialEngine'
import { useFinance } from '../context/FinanceContext'

export const ReportsView: React.FC = () => {
  const { summary, transfers, envelopes } = useFinance()

  if (!summary) return null

  // Calculate expense breakdown by category
  const expenseByCategory = summary.envelopes
    .filter((e) => e.spentAmount > 0)
    .sort((a, b) => b.spentAmount - a.spentAmount)

  const totalExpensesSpent = summary.totalExpenses || 1

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white">Laporan & Analisis Finansial</h2>
        <p className="text-xs text-slate-400">
          Evaluasi arus kas nyata tanpa bias mutasi transfer internal
        </p>
      </div>

      {/* Cashflow Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Pemasukan Nyata</span>
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400">
            {formatRupiah(summary.totalIncome)}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Pengeluaran Nyata</span>
            <span className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-rose-400">
            {formatRupiah(summary.totalExpenses)}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Arus Kas (Surplus Kas)</span>
            <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </span>
          </div>
          <p
            className={`text-2xl font-bold font-mono ${
              summary.totalIncome - summary.totalExpenses >= 0 ? 'text-indigo-300' : 'text-rose-400'
            }`}
          >
            {formatRupiah(summary.totalIncome - summary.totalExpenses)}
          </p>
        </div>
      </div>

      {/* Spending Breakdown by Envelope */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-400" />
            Proporsi Pengeluaran per Kategori / Amplop
          </h3>
          <span className="text-xs text-slate-400">
            Total {formatRupiah(summary.totalExpenses)}
          </span>
        </div>

        {expenseByCategory.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Belum ada pengeluaran tercatat pada amplop manapun.
          </div>
        ) : (
          <div className="space-y-4">
            {expenseByCategory.map((item) => {
              const pct = Math.round((item.spentAmount / totalExpensesSpent) * 100)

              return (
                <div key={item.envelope.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-white">{item.envelope.name}</span>
                    <span className="font-mono text-slate-300">
                      {formatRupiah(item.spentAmount)}{' '}
                      <span className="text-slate-500 text-[11px]">({pct}%)</span>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Transfer Audit Ledger (Transfers between envelopes) */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
            Audit Jurnal Transfer & Penutupan Defisit
          </h3>
          <span className="text-xs text-slate-400">{transfers.length} Mutasi Tercatat</span>
        </div>

        {transfers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Belum ada mutasi atau transfer antar amplop.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
            {transfers.map((tr) => {
              const src = tr.source_envelope_id
                ? envelopes.find((e) => e.id === tr.source_envelope_id)?.name || 'Amplop'
                : 'Saldo Bebas (Unallocated)'
              const dst = tr.destination_envelope_id
                ? envelopes.find((e) => e.id === tr.destination_envelope_id)?.name || 'Amplop'
                : 'Saldo Bebas (Unallocated)'

              return (
                <div key={tr.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">{tr.description}</span>
                    <span className="text-[11px] text-slate-400">
                      {src} → {dst} • <span className="font-mono">{tr.created_at.slice(0, 10)}</span>
                    </span>
                  </div>
                  <span className="font-mono font-bold text-indigo-300">
                    {formatRupiah(tr.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
