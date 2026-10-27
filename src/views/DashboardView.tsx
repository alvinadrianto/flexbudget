import React from 'react'
import {
  Wallet,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Sparkles,
  PiggyBank,
  Shield,
  Layers,
  ChevronRight,
  Plus,
  CheckCircle2,
} from 'lucide-react'
import { formatRupiah, checkAllowanceStatus } from '../services/financialEngine'
import type { Envelope, EnvelopeBalanceInfo } from '../types/finance'
import { useFinance } from '../context/FinanceContext'
import type { NavTab } from '../components/Navbar'

interface DashboardViewProps {
  onNavigateTab: (tab: NavTab) => void
  onOpenQuickAdd: (type: 'expense' | 'income') => void
  onOpenTransfer: (sourceId?: string | null, targetId?: string | null) => void
  onOpenDeficit: (envelopeInfo: EnvelopeBalanceInfo) => void
  onOpenRelease: (target: Envelope, pool: Envelope, poolBalance: number) => void
  onOpenSurplus: (sourceInfo: EnvelopeBalanceInfo) => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenQuickAdd,
  onOpenTransfer,
  onOpenDeficit,
  onOpenRelease,
  onOpenSurplus,
}) => {
  const { summary, envelopes, transactions, transfers, loadInitialTemplate, isLoading } = useFinance()

  if (!summary) return null

  // Find daily & weekly envelopes
  const dailyEnvelope = summary.envelopes.find((e) => e.envelope.type === 'spending_daily')
  const dailyPool = summary.envelopes.find((e) => e.envelope.id === dailyEnvelope?.envelope.funding_source_id)

  const weeklyEnvelope = summary.envelopes.find((e) => e.envelope.type === 'spending_weekly')
  const weeklyPool = summary.envelopes.find((e) => e.envelope.id === weeklyEnvelope?.envelope.funding_source_id)

  // Check whether allowances are already released for current cycle (today or this week)
  const dailyStatus = dailyEnvelope
    ? checkAllowanceStatus(dailyEnvelope.envelope.id, 'daily', transfers)
    : null

  const weeklyStatus = weeklyEnvelope
    ? checkAllowanceStatus(weeklyEnvelope.envelope.id, 'weekly', transfers)
    : null

  // Deficit envelopes requiring attention
  const deficitEnvelopes = summary.envelopes.filter((e) => e.isDeficit)

  return (
    <div className="space-y-6 pb-20">
      {/* Dashboard Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Ikhtisar Finansial</h2>
          <p className="text-xs text-slate-400">Kontrol anggaran fleksibel dan saldo kas terlacak secara terpadu</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenQuickAdd('expense')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Catat Pengeluaran
          </button>
          <button
            onClick={() => onOpenQuickAdd('income')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Catat Pemasukan
          </button>
        </div>
      </div>

      {/* INITIAL SETUP WIZARD BANNER (Shown when user has no envelopes configured) */}
      {envelopes.length === 0 && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-purple-950/50 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white">Mulai dengan Template Anggaran Fleksibel</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Terapkan alokasi bulanan terstruktur Rp3.800.000 dengan Pool Harian (Rp30.000/hari), Pool Jajan Mingguan (Rp200.000/minggu), Tabungan Rp1.000.000, Kebutuhan Bulanan (Bensin, Makanan Kucing), dan Dana Darurat Rp305.000.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={loadInitialTemplate}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoading ? 'Menerapkan...' : 'Terapkan Template Rp3.800.000'}
              </button>
              <button
                onClick={() => onNavigateTab('envelopes')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Buat Anggaran Kosong Sendiri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEFICIT ALERT BANNER (Primary Differentiator) */}
      {deficitEnvelopes.length > 0 && (
        <div className="p-5 rounded-3xl bg-rose-950/40 border border-rose-500/40 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {deficitEnvelopes.length} Amplop Mengalami Defisit (Overspent)
                </h3>
                <p className="text-xs text-rose-300">
                  Total kekurangan: <strong className="font-mono">{formatRupiah(summary.totalDeficitAmount)}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {deficitEnvelopes.map((item) => (
              <div
                key={item.envelope.id}
                className="p-3.5 rounded-2xl bg-slate-950/90 border border-rose-500/30 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-white block">{item.envelope.name}</span>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    Defisit {formatRupiah(item.deficitAmount)}
                  </span>
                </div>
                <button
                  onClick={() => onOpenDeficit(item)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition-all active:scale-95"
                >
                  Tutup Defisit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP STATS CARDS: Tracked Balance, Allocated, Unallocated */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tracked Balance Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Saldo Terlacak
            </span>
            <span className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
            {formatRupiah(summary.trackedBalance)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Pemasukan: <strong className="text-emerald-400 font-mono">+{formatRupiah(summary.totalIncome)}</strong></span>
            <span>Pengeluaran: <strong className="text-rose-400 font-mono">-{formatRupiah(summary.totalExpenses)}</strong></span>
          </div>
        </div>

        {/* Total Allocated Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Dana Teralokasi
            </span>
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
            {formatRupiah(summary.totalAllocated)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>{summary.envelopes.length} Amplop Anggaran Aktif</span>
            <button
              onClick={() => onNavigateTab('envelopes')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-0.5"
            >
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Unallocated Cash Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Saldo Belum Dialokasikan
            </span>
            <button
              onClick={() => onOpenTransfer(null, null)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
            >
              + Alokasikan
            </button>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
            summary.unallocatedCash < 0 ? 'text-rose-400' : 'text-slate-100'
          }`}>
            {formatRupiah(summary.unallocatedCash)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Status Konsistensi Buku:</span>
            <span className={`font-semibold ${summary.accountingInvariantValid ? 'text-emerald-400' : 'text-rose-400'}`}>
              {summary.accountingInvariantValid ? '100% Rekonsiliasi Tepat' : 'Perlu Rekonsiliasi'}
            </span>
          </div>
        </div>
      </div>

      {/* TIMEFRAME CASHFLOW SNIPPET (Today, Week, Month) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Hari Ini</span>
            <span className="text-xs font-bold text-white">
              +{formatRupiah(summary.todayIncome)} / <span className="text-rose-400">-{formatRupiah(summary.todayExpense)}</span>
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Net: <strong className={summary.todayIncome - summary.todayExpense >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {formatRupiah(summary.todayIncome - summary.todayExpense)}
            </strong>
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Minggu Ini</span>
            <span className="text-xs font-bold text-white">
              +{formatRupiah(summary.weekIncome)} / <span className="text-rose-400">-{formatRupiah(summary.weekExpense)}</span>
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Net: <strong className={summary.weekIncome - summary.weekExpense >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {formatRupiah(summary.weekIncome - summary.weekExpense)}
            </strong>
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Bulan Ini</span>
            <span className="text-xs font-bold text-white">
              +{formatRupiah(summary.monthIncome)} / <span className="text-rose-400">-{formatRupiah(summary.monthExpense)}</span>
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Net: <strong className={summary.monthIncome - summary.monthExpense >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {formatRupiah(summary.monthIncome - summary.monthExpense)}
            </strong>
          </span>
        </div>
      </div>

      {/* RECURRING ALLOWANCE CARDS (Daily & Weekly Spending from Pools) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Spending Allowance */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">Tunjangan Harian</h4>
                <p className="text-[11px] text-slate-400">
                  Target: {dailyEnvelope ? formatRupiah(dailyEnvelope.envelope.period_amount) : 'Rp0'} / hari
                </p>
              </div>
            </div>

            {dailyEnvelope && dailyPool && (
              <div className="flex items-center gap-2">
                {dailyStatus?.isReleased ? (
                  <>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Dirilis
                    </span>
                    <button
                      onClick={() => onOpenRelease(dailyEnvelope.envelope, dailyPool.envelope, dailyPool.balance)}
                      className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-semibold transition-colors border border-indigo-500/20"
                      title="Cairkan tunjangan ekstra"
                    >
                      + Ekstra
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onOpenRelease(dailyEnvelope.envelope, dailyPool.envelope, dailyPool.balance)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                  >
                    Rilis Hari Ini
                  </button>
                )}
              </div>
            )}
          </div>

          {dailyEnvelope ? (
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Sisa Saldo Amplop:</span>
                <span className={`text-xl font-bold font-mono ${
                  dailyEnvelope.balance < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {formatRupiah(dailyEnvelope.balance)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Terpakai Hari Ini:</span>
                <span className={`font-mono font-medium ${
                  (dailyEnvelope.spentThisPeriod ?? 0) > dailyEnvelope.envelope.period_amount ? 'text-rose-400' : 'text-slate-200'
                }`}>
                  {formatRupiah(dailyEnvelope.spentThisPeriod ?? 0)}
                </span>
              </div>
              {dailyPool && (
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Sisa Pool Harian:</span>
                  <span className="font-mono text-slate-200">{formatRupiah(dailyPool.balance)}</span>
                </div>
              )}
              {dailyStatus?.isReleased && (
                <p className="text-[10px] text-slate-400 pt-0.5">
                  {dailyStatus.nextResetDescription}
                </p>
              )}
              {dailyEnvelope.availableSurplus > 0 && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => onOpenSurplus(dailyEnvelope)}
                    className="text-xs text-emerald-400 hover:underline font-semibold"
                  >
                    Simpan Sisa ({formatRupiah(dailyEnvelope.availableSurplus)}) ke Tabungan →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Belum ada amplop harian yang diatur.</p>
          )}
        </div>

        {/* Weekly Spending Allowance */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">Tunjangan Mingguan (Jajan)</h4>
                <p className="text-[11px] text-slate-400">
                  Target: {weeklyEnvelope ? formatRupiah(weeklyEnvelope.envelope.period_amount) : 'Rp0'} / minggu
                </p>
              </div>
            </div>

            {weeklyEnvelope && weeklyPool && (
              <div className="flex items-center gap-2">
                {weeklyStatus?.isReleased ? (
                  <>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Dirilis
                    </span>
                    <button
                      onClick={() => onOpenRelease(weeklyEnvelope.envelope, weeklyPool.envelope, weeklyPool.balance)}
                      className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] font-semibold transition-colors border border-purple-500/20"
                      title="Cairkan tunjangan ekstra"
                    >
                      + Ekstra
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onOpenRelease(weeklyEnvelope.envelope, weeklyPool.envelope, weeklyPool.balance)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all active:scale-95"
                  >
                    Rilis Minggu Ini
                  </button>
                )}
              </div>
            )}
          </div>

          {weeklyEnvelope ? (
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Sisa Saldo Mingguan:</span>
                <span className={`text-xl font-bold font-mono ${
                  weeklyEnvelope.balance < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {formatRupiah(weeklyEnvelope.balance)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Terpakai Minggu Ini:</span>
                <span className={`font-mono font-medium ${
                  (weeklyEnvelope.spentThisPeriod ?? 0) > weeklyEnvelope.envelope.period_amount ? 'text-rose-400' : 'text-slate-200'
                }`}>
                  {formatRupiah(weeklyEnvelope.spentThisPeriod ?? 0)}
                </span>
              </div>
              {weeklyPool && (
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Sisa Pool Mingguan:</span>
                  <span className="font-mono text-slate-200">{formatRupiah(weeklyPool.balance)}</span>
                </div>
              )}
              {weeklyStatus?.isReleased && (
                <p className="text-[10px] text-slate-400 pt-0.5">
                  {weeklyStatus.nextResetDescription}
                </p>
              )}
              {weeklyEnvelope.availableSurplus > 0 && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => onOpenSurplus(weeklyEnvelope)}
                    className="text-xs text-purple-400 hover:underline font-semibold"
                  >
                    Simpan Sisa ({formatRupiah(weeklyEnvelope.availableSurplus)}) ke Cadangan →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Belum ada amplop mingguan yang diatur.</p>
          )}
        </div>
      </div>

      {/* SAVINGS & EMERGENCY FUND HIGHLIGHTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Tabungan Utama</span>
              <span className="text-lg font-bold text-white font-mono">
                {formatRupiah(summary.savingsTotal)}
              </span>
            </div>
          </div>
          <button
            onClick={() => onOpenTransfer(null, null)}
            className="text-xs text-emerald-400 hover:underline font-semibold"
          >
            Tambah Tabungan
          </button>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Dana Darurat / Cadangan</span>
              <span className="text-lg font-bold text-white font-mono">
                {formatRupiah(summary.emergencyTotal)}
              </span>
            </div>
          </div>
          <button
            onClick={() => onOpenTransfer(null, null)}
            className="text-xs text-sky-400 hover:underline font-semibold"
          >
            Cadangkan
          </button>
        </div>
      </div>

      {/* RECENT TRANSACTIONS & RECENT TRANSFERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Transaksi Terakhir</h4>
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              Lihat Semua ({transactions.length}) <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Belum ada transaksi tercatat. Klik tombol Tambah Pengeluaran/Pemasukan untuk memulai.
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.slice(0, 5).map((tx) => {
                const envName = tx.envelope_id
                  ? envelopes.find((e) => e.id === tx.envelope_id)?.name || 'Amplop'
                  : 'Saldo Terlacak'
                return (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">{tx.description}</span>
                      <span className="text-[11px] text-slate-400">
                        {tx.date} • <span className="text-indigo-300">{envName}</span>
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold font-mono ${
                        tx.type === 'income' ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatRupiah(tx.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Transfers (Audit Trail) */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Jurnal Mutasi Anggaran (Transfers)</h4>
            <button
              onClick={() => onOpenTransfer(null, null)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              Transfer Baru <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {transfers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Belum ada mutasi antar-amplop atau rilis alokasi.
            </div>
          ) : (
            <div className="space-y-2.5">
              {transfers.slice(0, 5).map((tr) => {
                const srcName = tr.source_envelope_id
                  ? envelopes.find((e) => e.id === tr.source_envelope_id)?.name || 'Amplop Sumber'
                  : 'Saldo Bebas'
                const dstName = tr.destination_envelope_id
                  ? envelopes.find((e) => e.id === tr.destination_envelope_id)?.name || 'Amplop Tujuan'
                  : 'Saldo Bebas'

                return (
                  <div
                    key={tr.id}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">{tr.description}</span>
                      <span className="text-[10px] text-slate-400">
                        {srcName} → {dstName}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-300">
                      {formatRupiah(tr.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
