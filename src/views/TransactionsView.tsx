import React, { useState } from 'react'
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react'
import { formatRupiah } from '../services/financialEngine'
import type { Transaction, TransactionType } from '../types/finance'
import { useFinance } from '../context/FinanceContext'

interface TransactionsViewProps {
  onOpenAddModal: (type?: TransactionType) => void
  onEditTransaction: (tx: Transaction) => void
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenAddModal,
  onEditTransaction,
}) => {
  const { transactions, envelopes, removeTransaction } = useFinance()
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all')
  const [selectedEnvelope, setSelectedEnvelope] = useState<string>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filtering
  const filtered = transactions.filter((tx) => {
    // Type filter
    if (selectedType !== 'all' && tx.type !== selectedType) return false

    // Envelope filter
    if (selectedEnvelope !== 'all') {
      if (selectedEnvelope === 'none' && tx.envelope_id !== null) return false
      if (selectedEnvelope !== 'none' && tx.envelope_id !== selectedEnvelope) return false
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchDesc = tx.description.toLowerCase().includes(q)
      const matchNotes = (tx.notes || '').toLowerCase().includes(q)
      const matchAmount = tx.amount.toString().includes(q)
      if (!matchDesc && !matchNotes && !matchAmount) return false
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
          <h2 className="text-xl font-extrabold text-white">Transaksi Keuangan</h2>
          <p className="text-xs text-slate-400">
            Catatan historis pemasukan dan pengeluaran terlacak ({filtered.length} transaksi)
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
              placeholder="Cari deskripsi, catatan, atau nominal..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">Semua Tipe</option>
            <option value="expense">Hanya Pengeluaran</option>
            <option value="income">Hanya Pemasukan</option>
          </select>

          {/* Envelope Filter */}
          <select
            value={selectedEnvelope}
            onChange={(e) => setSelectedEnvelope(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">Semua Amplop</option>
            <option value="none">Tanpa Amplop (Saldo Terlacak)</option>
            {envelopes.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions List Table / Cards */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 space-y-2">
            <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p>Tidak ada transaksi yang cocok dengan filter saat ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((tx) => {
              const env = envelopes.find((e) => e.id === tx.envelope_id)
              const isIncome = tx.type === 'income'

              return (
                <div
                  key={tx.id}
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

                    <div>
                      <span className="text-sm font-bold text-white block leading-tight">
                        {tx.description}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="font-mono">{tx.date}</span>
                        <span>•</span>
                        <span className="text-indigo-400 font-medium">
                          {env ? env.name : 'Saldo Terlacak'}
                        </span>
                        {tx.notes && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 italic max-w-xs truncate">{tx.notes}</span>
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
