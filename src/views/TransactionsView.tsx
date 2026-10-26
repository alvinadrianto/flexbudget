import React, { useState } from 'react'
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  ArrowRightLeft,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { formatRupiah } from '../services/financialEngine'
import type { Transaction, TransactionType, Transfer } from '../types/finance'
import { useFinance } from '../context/FinanceContext'

interface TransactionsViewProps {
  onOpenAddModal: (type?: TransactionType) => void
  onEditTransaction: (tx: Transaction) => void
}

type CombinedItem =
  | {
      kind: 'transaction'
      id: string
      date: string
      createdAt: string
      tx: Transaction
    }
  | {
      kind: 'transfer'
      id: string
      date: string
      createdAt: string
      tr: Transfer
    }

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenAddModal,
  onEditTransaction,
}) => {
  const { transactions, envelopes, transfers, summary, removeTransaction } = useFinance()
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<
    'all' | 'expense' | 'income' | 'deficit' | 'transfers'
  >('all')
  const [selectedEnvelope, setSelectedEnvelope] = useState<string>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calculate totals
  const totalIncome = summary?.totalIncome || 0
  const totalExpense = summary?.totalExpenses || 0
  const deficitCoveredTotal = transfers
    .filter((t) => t.type === 'deficit_coverage')
    .reduce((sum, t) => sum + t.amount, 0)

  // Map transactions to combined items
  const txItems: CombinedItem[] = transactions.map((tx) => ({
    kind: 'transaction',
    id: `tx-${tx.id}`,
    date: tx.date,
    createdAt: tx.created_at || tx.date,
    tx,
  }))

  // Map transfers to combined items
  const transferItems: CombinedItem[] = transfers.map((tr) => ({
    kind: 'transfer',
    id: `tr-${tr.id}`,
    date: tr.created_at.slice(0, 10),
    createdAt: tr.created_at,
    tr,
  }))

  // Combine and sort descending by date / created_at
  const allItems: CombinedItem[] = [...txItems, ...transferItems].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date)
    }
    return b.createdAt.localeCompare(a.createdAt)
  })

  // Filtering
  const filtered = allItems.filter((item) => {
    // Type Filter
    if (selectedType === 'expense') {
      if (item.kind !== 'transaction' || item.tx.type !== 'expense') return false
    } else if (selectedType === 'income') {
      if (item.kind !== 'transaction' || item.tx.type !== 'income') return false
    } else if (selectedType === 'deficit') {
      if (item.kind !== 'transfer' || item.tr.type !== 'deficit_coverage') return false
    } else if (selectedType === 'transfers') {
      if (item.kind !== 'transfer') return false
    }

    // Envelope Filter
    if (selectedEnvelope !== 'all') {
      if (selectedEnvelope === 'none') {
        if (item.kind === 'transaction' && item.tx.envelope_id !== null) return false
        if (item.kind === 'transfer') return false
      } else {
        if (item.kind === 'transaction' && item.tx.envelope_id !== selectedEnvelope) return false
        if (
          item.kind === 'transfer' &&
          item.tr.source_envelope_id !== selectedEnvelope &&
          item.tr.destination_envelope_id !== selectedEnvelope
        ) {
          return false
        }
      }
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase()
      if (item.kind === 'transaction') {
        const matchDesc = item.tx.description.toLowerCase().includes(q)
        const matchNotes = (item.tx.notes || '').toLowerCase().includes(q)
        const matchAmount = item.tx.amount.toString().includes(q)
        const envName =
          envelopes.find((e) => e.id === item.tx.envelope_id)?.name.toLowerCase() || ''
        const matchEnv = envName.includes(q)
        const matchDeficitTag = q.includes('defisit') && (matchDesc || matchNotes || matchEnv)
        if (!matchDesc && !matchNotes && !matchAmount && !matchEnv && !matchDeficitTag) {
          return false
        }
      } else {
        const matchDesc = item.tr.description.toLowerCase().includes(q)
        const matchAmount = item.tr.amount.toString().includes(q)
        const srcEnv =
          envelopes.find((e) => e.id === item.tr.source_envelope_id)?.name.toLowerCase() || ''
        const dstEnv =
          envelopes.find((e) => e.id === item.tr.destination_envelope_id)?.name.toLowerCase() || ''
        const matchDeficit =
          item.tr.type === 'deficit_coverage' && (q.includes('defisit') || q.includes('tutup'))
        if (!matchDesc && !matchAmount && !srcEnv.includes(q) && !dstEnv.includes(q) && !matchDeficit) {
          return false
        }
      }
    }

    return true
  })

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true)
      await removeTransaction(id)
      setDeleteConfirmId(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Riwayat Transaksi & Mutasi</h2>
          <p className="text-xs text-slate-400">
            Jurnal lengkap arus kas masuk, pengeluaran, penutupan defisit, dan mutasi anggaran ({filtered.length} entri)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenAddModal('expense')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Catat Pengeluaran
          </button>
          <button
            onClick={() => onOpenAddModal('income')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Catat Pemasukan
          </button>
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Total Pemasukan</span>
            <span className="text-sm font-extrabold font-mono text-emerald-400">
              +{formatRupiah(totalIncome)}
            </span>
          </div>
          <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ArrowUpRight className="w-4 h-4" />
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Total Pengeluaran</span>
            <span className="text-sm font-extrabold font-mono text-rose-400">
              -{formatRupiah(totalExpense)}
            </span>
          </div>
          <span className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Defisit Tertutup</span>
            <span className="text-sm font-extrabold font-mono text-amber-400">
              {formatRupiah(deficitCoveredTotal)}
            </span>
          </div>
          <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari deskripsi, catatan, amplop, atau defisit..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">Semua Aktivitas</option>
            <option value="expense">Hanya Pengeluaran Kas</option>
            <option value="income">Hanya Pemasukan Kas</option>
            <option value="deficit">Hanya Penutupan Defisit</option>
            <option value="transfers">Mutasi & Transfer Amplop</option>
          </select>

          {/* Envelope Filter */}
          <select
            value={selectedEnvelope}
            onChange={(e) => setSelectedEnvelope(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">Semua Amplop</option>
            <option value="none">Tanpa Amplop (Saldo Bebas)</option>
            {envelopes.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Activity List Table / Cards */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 space-y-2">
            <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p>Tidak ada transaksi atau mutasi yang cocok dengan filter saat ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((item) => {
              if (item.kind === 'transaction') {
                const tx = item.tx
                const env = envelopes.find((e) => e.id === tx.envelope_id)
                const isIncome = tx.type === 'income'

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-950/40 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isIncome
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm font-bold text-white block leading-tight">
                          {tx.description}
                        </span>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono">{tx.date}</span>
                          <span>•</span>
                          <span className="text-indigo-400 font-medium">
                            {env ? env.name : 'Saldo Bebas'}
                          </span>
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500 italic max-w-xs truncate">
                                {tx.notes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/50">
                      <span
                        className={`text-base font-extrabold font-mono ${
                          isIncome ? 'text-emerald-400' : 'text-slate-100'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Ubah Transaksi"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmId(tx.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              } else {
                // Item is a TRANSFER / MUTASI (e.g. Deficit coverage, Pool release, Surplus routing)
                const tr = item.tr
                const srcEnv = envelopes.find((e) => e.id === tr.source_envelope_id)
                const dstEnv = envelopes.find((e) => e.id === tr.destination_envelope_id)
                const isDeficitCoverage = tr.type === 'deficit_coverage'
                const isPoolRelease = tr.type === 'pool_release'
                const isSurplus = tr.type === 'surplus_routing'

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isDeficitCoverage
                        ? 'bg-amber-950/15 hover:bg-amber-950/25'
                        : 'hover:bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isDeficitCoverage
                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                            : isPoolRelease
                            ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
                            : isSurplus
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                            : 'bg-purple-500/15 border border-purple-500/30 text-purple-400'
                        }`}
                      >
                        {isDeficitCoverage ? (
                          <ShieldAlert className="w-5 h-5" />
                        ) : isPoolRelease ? (
                          <Sparkles className="w-5 h-5" />
                        ) : (
                          <ArrowRightLeft className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white leading-tight">
                            {tr.description}
                          </span>
                          {isDeficitCoverage && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                              🛡️ Tutup Defisit
                            </span>
                          )}
                          {isPoolRelease && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                              Rilis Tunjangan
                            </span>
                          )}
                          {isSurplus && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                              Simpan Surplus
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono">{item.date}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-300">
                            {srcEnv ? srcEnv.name : 'Saldo Bebas'}
                          </span>
                          <span>➔</span>
                          <span className="font-semibold text-indigo-300">
                            {dstEnv ? dstEnv.name : 'Saldo Bebas'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/50">
                      <div className="text-right">
                        <span
                          className={`text-base font-extrabold font-mono block ${
                            isDeficitCoverage
                              ? 'text-amber-400'
                              : 'text-indigo-300'
                          }`}
                        >
                          {formatRupiah(tr.amount)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {isDeficitCoverage ? 'Dialihkan untuk defisit' : 'Mutasi Amplop'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Hapus Transaksi?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tindakan ini akan membatalkan transaksi dari buku kas dan menghitung ulang seluruh saldo amplop serta saldo terlacak secara otomatis.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
