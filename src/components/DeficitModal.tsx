import React, { useState, useEffect } from 'react'
import {
  X,
  AlertTriangle,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Coffee,
} from 'lucide-react'
import type { Envelope, EnvelopeBalanceInfo } from '../types/finance'
import { formatRupiah, parseRupiahInput } from '../services/financialEngine'

interface DeficitModalProps {
  isOpen: boolean
  onClose: () => void
  deficitEnvelopeInfo: EnvelopeBalanceInfo | null
  allEnvelopeBalances: EnvelopeBalanceInfo[]
  onCoverManual: (
    deficitEnvelopeId: string,
    allocations: { sourceEnvelope: Envelope; availableFunds: number; amountToTake: number }[]
  ) => Promise<{ success: boolean; error?: string; remainingDeficit?: number }>
  onCoverAuto: (
    deficitEnvelopeId: string
  ) => Promise<{ success: boolean; summaryLog: string[]; remainingDeficit: number }>
}

export const DeficitModal: React.FC<DeficitModalProps> = ({
  isOpen,
  onClose,
  deficitEnvelopeInfo,
  allEnvelopeBalances,
  onCoverManual,
  onCoverAuto,
}) => {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [allocations, setAllocations] = useState<{ [envelopeId: string]: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoLogs, setAutoLogs] = useState<string[]>([])
  const [showMonthlySpendingOptions, setShowMonthlySpendingOptions] = useState(false)

  useEffect(() => {
    setAllocations({})
    setError(null)
    setAutoLogs([])
    setShowMonthlySpendingOptions(false)
  }, [isOpen, deficitEnvelopeInfo])

  if (!isOpen || !deficitEnvelopeInfo) return null

  const deficitAmount = deficitEnvelopeInfo.deficitAmount
  const deficitEnv = deficitEnvelopeInfo.envelope

  // 1. Primary Source: Funding Pools (Pools Bulanan)
  const poolSources = allEnvelopeBalances
    .filter(
      (b) =>
        b.envelope.id !== deficitEnv.id &&
        b.availableSurplus > 0 &&
        b.envelope.type === 'funding_pool'
    )
    .sort((a, b) => {
      // Prioritize the linked funding pool for this envelope
      if (a.envelope.id === deficitEnv.funding_source_id) return -1
      if (b.envelope.id === deficitEnv.funding_source_id) return 1
      return b.availableSurplus - a.availableSurplus
    })

  // 2. Discretionary Allowances (Tunjangan Jajan Mingguan & Fleksibel)
  const allowanceSources = allEnvelopeBalances
    .filter(
      (b) =>
        b.envelope.id !== deficitEnv.id &&
        b.availableSurplus > 0 &&
        (b.envelope.type === 'spending_weekly' || b.envelope.type === 'spending_daily')
    )
    .sort((a, b) => b.availableSurplus - a.availableSurplus)

  // 3. Emergency Fund & Savings (Dana Darurat & Tabungan)
  const reserveSources = allEnvelopeBalances
    .filter(
      (b) =>
        b.envelope.id !== deficitEnv.id &&
        b.availableSurplus > 0 &&
        (b.envelope.type === 'emergency_fund' ||
          b.envelope.type === 'reserve' ||
          b.envelope.type === 'savings')
    )
    .sort((a, b) => {
      // Put emergency_fund and reserve first, then savings
      const score = (t: string) => (t === 'emergency_fund' ? 1 : t === 'reserve' ? 2 : 3)
      return score(a.envelope.type) - score(b.envelope.type)
    })

  // 4. Operational Monthly Spending (Beda Kategori - Excluded by default!)
  const monthlySpendingSources = allEnvelopeBalances.filter(
    (b) =>
      b.envelope.id !== deficitEnv.id &&
      b.availableSurplus > 0 &&
      b.envelope.type !== 'funding_pool' &&
      b.envelope.type !== 'spending_weekly' &&
      b.envelope.type !== 'spending_daily' &&
      b.envelope.type !== 'emergency_fund' &&
      b.envelope.type !== 'reserve' &&
      b.envelope.type !== 'savings'
  )

  // Calculate sum of chosen manual coverage amounts across all inputs
  let totalManualCovered = 0
  for (const b of allEnvelopeBalances) {
    const val = parseRupiahInput(allocations[b.envelope.id] || '0')
    totalManualCovered += val
  }

  const remainingAfterManual = Math.max(0, deficitAmount - totalManualCovered)
  const newDeficitEnvBalance = deficitEnvelopeInfo.balance + totalManualCovered

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (totalManualCovered <= 0) {
      setError('Masukkan nominal penutupan defisit setidaknya dari satu amplop sumber.')
      return
    }

    const payload = allEnvelopeBalances
      .filter((b) => b.envelope.id !== deficitEnv.id)
      .map((src) => ({
        sourceEnvelope: src.envelope,
        availableFunds: src.availableSurplus,
        amountToTake: parseRupiahInput(allocations[src.envelope.id] || '0'),
      }))
      .filter((a) => a.amountToTake > 0)

    try {
      setIsSubmitting(true)
      const res = await onCoverManual(deficitEnv.id, payload)
      if (!res.success) {
        setError(res.error || 'Gagal menutup defisit.')
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAutoSubmit = async () => {
    setError(null)
    setAutoLogs([])
    try {
      setIsSubmitting(true)
      const res = await onCoverAuto(deficitEnv.id)
      setAutoLogs(res.summaryLog)
      if (res.success && res.remainingDeficit === 0) {
        setTimeout(() => onClose(), 1200)
      } else if (res.remainingDeficit > 0) {
        setError(`Sebagian defisit tertutup, masih tersisa ${formatRupiah(res.remainingDeficit)}.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menjalankan penutupan otomatis.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderSourceCard = (
    src: EnvelopeBalanceInfo,
    badgeText?: string,
    badgeColor?: string,
    isLinkedPool?: boolean
  ) => {
    const currentEntered = parseRupiahInput(allocations[src.envelope.id] || '0')

    return (
      <div
        key={src.envelope.id}
        className={`p-3.5 rounded-2xl bg-slate-950 border transition-colors ${
          isLinkedPool
            ? 'border-indigo-500/50 bg-indigo-950/20 hover:border-indigo-500'
            : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white block">{src.envelope.name}</span>
            {badgeText && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  badgeColor || 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {badgeText}
              </span>
            )}
          </div>
          {src.envelope.min_protected_balance > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              <ShieldCheck className="w-3 h-3" />
              Proteksi {formatRupiah(src.envelope.min_protected_balance)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
          <span>
            Saldo Bebas:{' '}
            <strong className="text-emerald-400 font-mono font-bold">
              {formatRupiah(src.availableSurplus)}
            </strong>
          </span>
          {isLinkedPool && (
            <span className="text-indigo-300 text-[10px] font-semibold">
              Pool induk dari {deficitEnv.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={
                allocations[src.envelope.id]
                  ? new Intl.NumberFormat('id-ID').format(currentEntered)
                  : ''
              }
              onChange={(e) => {
                const val = parseRupiahInput(e.target.value)
                const capped = Math.min(val, src.availableSurplus)
                setAllocations((prev) => ({
                  ...prev,
                  [src.envelope.id]: capped > 0 ? capped.toString() : '',
                }))
              }}
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-white placeholder-slate-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              // Fill either full remaining deficit or full source available
              const needed = Math.max(0, deficitAmount - (totalManualCovered - currentEntered))
              const canTake = Math.min(needed, src.availableSurplus)
              setAllocations((prev) => ({
                ...prev,
                [src.envelope.id]: canTake > 0 ? canTake.toString() : '',
              }))
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-indigo-300 transition-colors"
          >
            Ambil Sisa
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Penyelesaian Defisit Anggaran</h2>
              <p className="text-xs text-rose-400 font-medium">
                Amplop {deficitEnv.name} mengalami overspend
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deficit Banner */}
        <div className="my-4 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs text-rose-300 font-medium block">
              Total Defisit yang Harus Ditutup
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">
              {formatRupiah(deficitAmount)}
            </span>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-400 block">Saldo Saat Ini:</span>
            <span className="text-rose-400 font-bold font-mono">
              {formatRupiah(deficitEnvelopeInfo.balance)}
            </span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'manual'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Penutupan Manual
          </button>
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'auto'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Otomatis (Sesuai Prioritas)
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {mode === 'manual' ? (
            <form id="deficit-manual-form" onSubmit={handleManualSubmit} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Gunakan <strong>Pools Bulanan</strong> atau <strong>Dana Darurat / Tabungan</strong>{' '}
                sebagai sumber penutup defisit tanpa mengorbankan pos pengeluaran bulanan lainnya.
              </p>

              {/* SECTION 1: POOLS BULANAN (RECOMMENDED PRIMARY) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>1. Pool Anggaran Bulanan (Sangat Direkomendasikan)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Pool bulanan berfungsi sebagai cadangan alokasi rutin. Menggunakan pool adalah langkah paling logis sebelum menyentuh tabungan.
                </p>

                {poolSources.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 text-xs text-center">
                    Tidak ada saldo tersisa di pool anggaran bulanan.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {poolSources.map((src) => {
                      const isLinked = src.envelope.id === deficitEnv.funding_source_id
                      return renderSourceCard(
                        src,
                        isLinked ? '⭐ Pool Terkait' : 'Pool Bulanan',
                        isLinked
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                          : 'bg-purple-500/20 border-purple-500/40 text-purple-300',
                        isLinked
                      )
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: TUNJANGAN JAJAN MINGGUAN & FLEKSIBEL */}
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                  <Coffee className="w-4 h-4 text-purple-400" />
                  <span>2. Tunjangan Jajan Mingguan & Fleksibel</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Sisa saldo uang jajan mingguan yang belum terpakai. Mengorbankan pos jajan jauh lebih fleksibel dan bijak daripada menguras tabungan.
                </p>

                {allowanceSources.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 text-xs text-center">
                    Tidak ada saldo tersisa di amplop jajan mingguan atau tunjangan fleksibel.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {allowanceSources.map((src) =>
                      renderSourceCard(
                        src,
                        src.envelope.type === 'spending_weekly' ? 'Jajan Mingguan' : 'Tunjangan Harian',
                        'bg-purple-500/20 border-purple-500/40 text-purple-300 font-semibold'
                      )
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 3: DANA DARURAT & TABUNGAN (SECONDARY RESERVE) */}
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>3. Dana Darurat & Tabungan Cadangan</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Jaring pengaman cadangan untuk menyerap pengeluaran di luar kendali. Saldo di bawah batas proteksi tetap aman terlindungi.
                </p>

                {reserveSources.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 text-xs text-center">
                    Tidak ada saldo bebas di atas proteksi minimum tabungan atau dana darurat.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {reserveSources.map((src) =>
                      renderSourceCard(
                        src,
                        src.envelope.type === 'emergency_fund' ? 'Dana Darurat' : 'Tabungan',
                        src.envelope.type === 'emergency_fund'
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      )
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 4: COLLAPSED MONTHLY SPENDING (EXCLUDED BY DEFAULT - DIFFERENT CATEGORY) */}
              {monthlySpendingSources.length > 0 && (
                <div className="pt-2 border-t border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => setShowMonthlySpendingOptions(!showMonthlySpendingOptions)}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Pos Pengeluaran Bulanan Tetap ({monthlySpendingSources.length} amplop - Beda Kategori)
                      </span>
                    </div>
                    <span className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1">
                      {showMonthlySpendingOptions ? (
                        <>
                          Sembunyikan <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          Buka Opsi (Tidak Disarankan) <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </span>
                  </button>

                  {showMonthlySpendingOptions && (
                    <div className="mt-2 p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3 animate-in fade-in">
                      <p className="text-[11px] text-amber-300 leading-relaxed">
                        ⚠️ <strong>Peringatan Beda Kategori:</strong> Mengambil dana dari pos pengeluaran bulanan rutin (seperti Bensin atau Makanan Kucing) dapat menyebabkan pos tersebut mengalami kekurangan dana di akhir bulan.
                      </p>
                      <div className="space-y-2">
                        {monthlySpendingSources.map((src) =>
                          renderSourceCard(
                            src,
                            'Pengeluaran Bulanan',
                            'bg-rose-500/20 border-rose-500/30 text-rose-300'
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Preview Summary */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Total yang ditutup:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{formatRupiah(totalManualCovered)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Proyeksi saldo {deficitEnv.name}:</span>
                  <span
                    className={`font-mono font-bold ${
                      newDeficitEnvBalance < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatRupiah(newDeficitEnvBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Sisa defisit belum tertutup:</span>
                  <span className="font-mono font-semibold text-rose-300">
                    {formatRupiah(remainingAfterManual)}
                  </span>
                </div>
              </div>
            </form>
          ) : (
            /* AUTOMATIC MODE */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2 text-xs">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Hierarki Penutupan Otomatis Cerdas
                </h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Sistem FlexBudget akan mencari dana penutup defisit secara berurutan sesuai prinsip finansial yang benar:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] pt-1">
                  <li>
                    <strong className="text-indigo-300">Pool Anggaran Bulanan Terkait</strong> (misal Daily Spending Pool untuk Tunjangan Harian)
                  </li>
                  <li>
                    <strong className="text-purple-300">Pools Bulanan Lainnya</strong> yang masih memiliki saldo
                  </li>
                  <li>
                    <strong className="text-pink-300">Tunjangan Jajan Mingguan & Fleksibel</strong> (sisa jajan minggu ini)
                  </li>
                  <li>
                    <strong className="text-amber-300">Dana Darurat / Cadangan</strong> (di atas batas proteksi)
                  </li>
                  <li>
                    <strong className="text-emerald-300">Tabungan Utama</strong> (di atas batas proteksi)
                  </li>
                </ol>
                <p className="text-[10px] text-slate-400 italic pt-1">
                  * Pos pengeluaran bulanan tetap (seperti Bensin atau Makanan Kucing) <strong>tidak akan pernah</strong> disentuh secara otomatis.
                </p>
              </div>

              {autoLogs.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <span className="font-bold text-slate-300 block mb-1">
                    Riwayat Eksekusi Otomatis:
                  </span>
                  {autoLogs.map((log, i) => (
                    <p key={i} className="text-slate-400 font-mono text-[11px]">
                      • {log}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800/80 mt-2">
          {mode === 'manual' ? (
            <button
              form="deficit-manual-form"
              type="submit"
              disabled={isSubmitting || totalManualCovered === 0}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses Transfer...' : 'Terapkan Penutupan Defisit'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAutoSubmit}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              {isSubmitting ? 'Menganalisis & Menutup Defisit...' : 'Jalankan Penutupan Otomatis'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
