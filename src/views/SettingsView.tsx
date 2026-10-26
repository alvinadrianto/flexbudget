import React, { useState } from 'react'
import {
  Settings,
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  X,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react'
import { parseRupiahInput } from '../services/financialEngine'
import {
  createFullJSONBackup,
  exportTransactionsToCSV,
  exportTransfersToCSV,
  triggerFileDownload,
  validateJSONBackup,
} from '../services/backupService'
import { useAuth } from '../context/AuthContext'
import { useFinance } from '../context/FinanceContext'
import { DataService } from '../services/dataService'

interface SettingsViewProps {
  onOpenCloudGuide: () => void
  onOpenAuthModal: () => void
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenCloudGuide,
  onOpenAuthModal,
}) => {
  const { user, isSupabaseConnected } = useAuth()
  const {
    profile,
    envelopes,
    transactions,
    transfers,
    deficitRules,
    restoreFromBackup,
    refreshData,
    resetAllData,
  } = useFinance()

  const [openingBalanceStr, setOpeningBalanceStr] = useState(
    profile ? profile.opening_balance.toString() : '0'
  )
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null)

  // Reset all data states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetConfirmationInput, setResetConfirmationInput] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null)

  const handlePerformReset = async () => {
    if (resetConfirmationInput.trim().toUpperCase() !== 'RESET') return

    try {
      setIsResetting(true)
      setResetErrorMessage(null)
      await resetAllData()
      setIsResetModalOpen(false)
      setResetConfirmationInput('')
      setOpeningBalanceStr('0')
      setResetSuccessMessage('Semua data keuangan berhasil direset ke kondisi awal (fresh start).')
      setTimeout(() => setResetSuccessMessage(null), 6000)
    } catch (err: any) {
      console.error('Gagal mereset data:', err)
      setResetErrorMessage(err.message || 'Gagal mereset data. Silakan coba lagi.')
    } finally {
      setIsResetting(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    try {
      setIsSavingProfile(true)
      const newBal = parseRupiahInput(openingBalanceStr)
      await DataService.updateProfile({
        ...profile,
        opening_balance: newBal,
      })
      await refreshData()
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 2000)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleExportTransactionsCSV = () => {
    const csv = exportTransactionsToCSV(transactions, envelopes)
    triggerFileDownload(csv, `FlexBudget_Transaksi_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;')
  }

  const handleExportTransfersCSV = () => {
    const csv = exportTransfersToCSV(transfers, envelopes)
    triggerFileDownload(csv, `FlexBudget_Mutasi_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;')
  }

  const handleExportJSON = () => {
    if (!profile) return
    const backup = createFullJSONBackup({
      profile,
      envelopes,
      transactions,
      transfers,
      deficitRules,
      periodReviews: [],
    })
    const jsonStr = JSON.stringify(backup, null, 2)
    triggerFileDownload(
      jsonStr,
      `FlexBudget_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8;'
    )
  }

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null)
    setRestoreSuccess(null)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const validation = validateJSONBackup(text)
        if (!validation.valid || !validation.data) {
          setRestoreError(validation.error || 'File JSON tidak valid.')
          return
        }

        const confirmed = window.confirm(
          `Pulihkan data dari backup versi ${validation.data.version}? Ini akan memulihkan ${validation.data.envelopes.length} amplop dan ${validation.data.transactions.length} transaksi.`
        )

        if (confirmed) {
          await restoreFromBackup(validation.data)
          setRestoreSuccess('Data berhasil dipulihkan dari cadangan!')
        }
      } catch (err) {
        setRestoreError(err instanceof Error ? err.message : 'Gagal memproses file cadangan.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6 pb-20 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white">Pengaturan & Cadangan Data</h2>
        <p className="text-xs text-slate-400">
          Konfigurasi saldo awal, integrasi cloud Supabase, ekspor CSV, dan pemulihan data independen
        </p>
      </div>

      {/* Cloud & Authentication Status Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                isSupabaseConnected
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isSupabaseConnected ? 'Terhubung ke Supabase PostgreSQL' : 'Penyimpanan Lokal Aktif (Demo Mode)'}
              </h3>
              <p className="text-xs text-slate-400">
                {isSupabaseConnected
                  ? `Akun: ${user?.email || 'Pemilik'} (Row Level Security Aktif)`
                  : 'Data disimpan di peramban Anda. Hubungkan ke Supabase gratis untuk backup cloud.'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCloudGuide}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-indigo-300 border border-slate-700 transition-colors"
          >
            Panduan Cloud
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400">Status Autentikasi:</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">{user?.fullName || 'Tamu'}</span>
            <button
              onClick={onOpenAuthModal}
              className="text-indigo-400 hover:underline font-bold"
            >
              Ganti Akun
            </button>
          </div>
        </div>
      </div>

      {/* Opening Balance Configuration */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          Saldo Awal Pembukaan Buku (Opening Balance)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Saldo uang riil yang sudah ada sebelum Anda mulai mencatat pemasukan dan pengeluaran di FlexBudget.
        </p>

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="relative max-w-sm">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={openingBalanceStr ? new Intl.NumberFormat('id-ID').format(parseRupiahInput(openingBalanceStr)) : ''}
              onChange={(e) => setOpeningBalanceStr(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSavingProfile ? 'Menyimpan...' : 'Perbarui Saldo Awal'}
            </button>
            {profileSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Berhasil disimpan!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Data Export & Backup */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-indigo-400" />
          Ekspor Data Mandiri & Cadangan JSON
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          FlexBudget menjamin data Anda adalah milik Anda sepenuhnya. Unduh cadangan berkala agar Anda selalu memiliki salinan offline independen.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={handleExportTransactionsCSV}
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-all group"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white block">CSV Transaksi</span>
            <span className="text-[11px] text-slate-500">Format spreadsheet Excel</span>
          </button>

          <button
            onClick={handleExportTransfersCSV}
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-all group"
          >
            <FileSpreadsheet className="w-5 h-5 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white block">CSV Mutasi Transfer</span>
            <span className="text-[11px] text-slate-500">Jurnal audit pergerakan dana</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-all group"
          >
            <Download className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white block">Full Backup (JSON)</span>
            <span className="text-[11px] text-slate-500">Seluruh aturan, amplop & data</span>
          </button>
        </div>
      </div>

      {/* Restore from JSON Backup */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-400" />
          Pulihkan Data dari File JSON
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Pilih file backup JSON versi 1.0 yang sebelumnya telah Anda unduh. Sistem akan memvalidasi struktur sebelum menerapkan pemulihan.
        </p>

        {restoreError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {restoreError}
          </div>
        )}

        {restoreSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {restoreSuccess}
          </div>
        )}

        <div className="pt-1">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Pilih File Backup JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileRestore}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone: Reset All Data */}
      <div className="p-6 rounded-3xl bg-rose-950/20 border border-rose-900/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Zona Berbahaya: Reset Semua Data
          </h3>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300">
            Tindakan Permanen
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Mereset seluruh data keuangan di akun Anda: menghapus semua amplop anggaran, riwayat transaksi, mutasi/transfer, aturan defisit, dan mengembalikan saldo awal ke Rp 0. Sangat cocok jika Anda ingin memulai kembali pencatatan dari awal (fresh start).
        </p>

        {resetSuccessMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{resetSuccessMessage}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setResetConfirmationInput('')
              setResetErrorMessage(null)
              setIsResetModalOpen(true)
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/40 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Reset Semua Data
          </button>
          <span className="text-[11px] text-slate-400">
            Data aktif: <strong className="text-slate-200">{envelopes.length}</strong> amplop, <strong className="text-slate-200">{transactions.length}</strong> transaksi, <strong className="text-slate-200">{transfers.length}</strong> mutasi
          </span>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-900/60 p-6 shadow-2xl shadow-rose-950/60 space-y-5 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reset Semua Data?</h3>
                  <p className="text-xs text-rose-300 font-medium">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isResetting && setIsResetModalOpen(false)}
                disabled={isResetting}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <p className="font-semibold text-slate-200">Data berikut akan dihapus secara permanen:</p>
              <ul className="space-y-1.5 text-slate-400">
                <li className="flex items-center gap-2 text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <strong>{envelopes.length}</strong> Amplop anggaran beserta seluruh alokasinya
                </li>
                <li className="flex items-center gap-2 text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <strong>{transactions.length}</strong> Catatan transaksi pengeluaran & pemasukan
                </li>
                <li className="flex items-center gap-2 text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <strong>{transfers.length}</strong> Log mutasi rilis anggaran & penutupan defisit
                </li>
                <li className="flex items-center gap-2 text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <strong>{deficitRules.length}</strong> Aturan otomatisasi defisit
                </li>
                <li className="flex items-center gap-2 text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  Saldo awal direset kembali ke <strong>Rp 0</strong>
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
              💡 <strong>Saran:</strong> Jika Anda mungkin membutuhkan data ini di kemudian hari, pastikan Anda telah mengunduh <strong>Full Backup (JSON)</strong> terlebih dahulu.
            </div>

            {resetErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
                {resetErrorMessage}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Ketik <span className="font-bold text-rose-400 font-mono tracking-wider">RESET</span> untuk mengonfirmasi:
              </label>
              <input
                type="text"
                value={resetConfirmationInput}
                onChange={(e) => setResetConfirmationInput(e.target.value)}
                placeholder='Ketik "RESET"'
                disabled={isResetting}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono text-sm tracking-wider uppercase text-center"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePerformReset}
                disabled={resetConfirmationInput.trim().toUpperCase() !== 'RESET' || isResetting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-rose-950/40"
              >
                {isResetting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Mereset Data...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ya, Hapus Semua Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

