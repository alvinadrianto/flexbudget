import React, { useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { FinanceProvider, useFinance } from './context/FinanceContext'
import { useAuth } from './context/AuthContext'
import { isSupabaseConfigured } from './services/supabaseClient'
import { Navbar } from './components/Navbar'
import type { NavTab } from './components/Navbar'
import { DashboardView } from './views/DashboardView'
import { TransactionsView } from './views/TransactionsView'
import { EnvelopesView } from './views/EnvelopesView'
import { ReviewView } from './views/ReviewView'
import { ReportsView } from './views/ReportsView'
import { SettingsView } from './views/SettingsView'
import { TransactionModal } from './components/TransactionModal'
import { TransferModal } from './components/TransferModal'
import { DeficitModal } from './components/DeficitModal'
import { ReleaseModal } from './components/ReleaseModal'
import { SurplusModal } from './components/SurplusModal'
import { SupabaseGuideModal } from './components/SupabaseGuideModal'
import { AuthModal } from './components/AuthModal'
import type { Envelope, EnvelopeBalanceInfo, Transaction, TransactionType } from './types/finance'
import { Mail, KeyRound, User, CheckCircle2 } from 'lucide-react'

// Login Gate: shows when Supabase is configured but no user is logged in
const LoginGate: React.FC = () => {
  const { login, register, resetPassword } = useAuth()
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    try {
      setIsSubmitting(true)
      if (tab === 'login') {
        const res = await login(email, password)
        if (!res.success) setError(res.error || 'Email atau password salah.')
      } else if (tab === 'register') {
        const res = await register(email, password, fullName)
        if (!res.success) {
          setError(res.error || 'Pendaftaran gagal.')
        } else {
          setSuccessMsg('Akun berhasil dibuat! Silakan cek email untuk konfirmasi, lalu login.')
        }
      } else {
        const res = await resetPassword(email)
        if (!res.success) {
          setError(res.error || 'Gagal mengirim reset password.')
        } else {
          setSuccessMsg('Link reset password telah dikirim ke email kamu.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-purple-950/20 pointer-events-none" />
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-400 p-[2px] shadow-2xl shadow-indigo-500/30 mb-4">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-indigo-400 text-2xl">
              FB
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">FlexBudget</h1>
          <p className="text-sm text-slate-400 mt-1">Kontrol Finansial Personal</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          {/* Tab switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); setSuccessMsg(null) }}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === 'login' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); setSuccessMsg(null) }}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === 'register' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daftar
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Lengkap</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><User className="w-4 h-4" /></span>
                  <input
                    type="text" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nama kamu"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Mail className="w-4 h-4" /></span>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {tab !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-slate-400">Kata Sandi</label>
                  {tab === 'login' && (
                    <button type="button" onClick={() => setTab('forgot')} className="text-[11px] text-indigo-400 hover:underline">
                      Lupa sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><KeyRound className="w-4 h-4" /></span>
                  <input
                    type="password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              {isSubmitting ? 'Memproses...'
                : tab === 'login' ? 'Masuk ke FlexBudget'
                : tab === 'register' ? 'Buat Akun'
                : 'Kirim Link Reset'}
            </button>
          </form>

          {tab === 'forgot' && (
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); setSuccessMsg(null) }}
              className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Kembali ke halaman masuk
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-4">
          FlexBudget · Manajemen Keuangan Pribadi
        </p>
      </div>
    </div>
  )
}

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard')

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [txModalType, setTxModalType] = useState<TransactionType>('expense')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferSourceId, setTransferSourceId] = useState<string | null>(null)
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null)

  const [isDeficitModalOpen, setIsDeficitModalOpen] = useState(false)
  const [deficitInfo, setDeficitInfo] = useState<EnvelopeBalanceInfo | null>(null)

  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<Envelope | null>(null)
  const [releasePool, setReleasePool] = useState<Envelope | null>(null)
  const [releasePoolBal, setReleasePoolBal] = useState(0)

  const [isSurplusModalOpen, setIsSurplusModalOpen] = useState(false)
  const [surplusSource, setSurplusSource] = useState<EnvelopeBalanceInfo | null>(null)

  const [isCloudGuideOpen, setIsCloudGuideOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const {
    summary,
    envelopes,
    transfers,
    addTransaction,
    editTransaction,
    transferFunds,
    releaseAllowance,
    routeSurplus,
    coverDeficitManually,
    coverDeficitAutomatically,
  } = useFinance()

  const handleOpenQuickAdd = (type: TransactionType = 'expense') => {
    setTxModalType(type)
    setEditingTx(null)
    setIsTxModalOpen(true)
  }

  const handleEditTx = (tx: Transaction) => {
    setEditingTx(tx)
    setTxModalType(tx.type)
    setIsTxModalOpen(true)
  }

  const handleOpenTransfer = (sourceId: string | null = null, targetId: string | null = null) => {
    setTransferSourceId(sourceId)
    setTransferTargetId(targetId)
    setIsTransferModalOpen(true)
  }

  const handleOpenDeficit = (info: EnvelopeBalanceInfo) => {
    setDeficitInfo(info)
    setIsDeficitModalOpen(true)
  }

  const handleOpenRelease = (target: Envelope, pool: Envelope, poolBalance: number) => {
    setReleaseTarget(target)
    setReleasePool(pool)
    setReleasePoolBal(poolBalance)
    setIsReleaseModalOpen(true)
  }

  const handleOpenSurplus = (info: EnvelopeBalanceInfo) => {
    setSurplusSource(info)
    setIsSurplusModalOpen(true)
  }

  const { user, isLoading } = useAuth()

  // Show login gate when Supabase is configured but user is not logged in
  if (isSupabaseConfigured && !isLoading && !user) {
    return <LoginGate />
  }

  // Show loading spinner while checking auth session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Memuat sesi...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation (Desktop Sidebar & Mobile Header + Bottom Nav) */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenQuickAdd={handleOpenQuickAdd}
        onOpenCloudGuide={() => setIsCloudGuideOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 md:py-8 md:px-10 px-4 pt-20 pb-24 md:pb-8 max-w-7xl mx-auto">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setCurrentTab}
            onOpenQuickAdd={handleOpenQuickAdd}
            onOpenTransfer={handleOpenTransfer}
            onOpenDeficit={handleOpenDeficit}
            onOpenRelease={handleOpenRelease}
            onOpenSurplus={handleOpenSurplus}
          />
        )}

        {currentTab === 'transactions' && (
          <TransactionsView
            onOpenAddModal={handleOpenQuickAdd}
            onEditTransaction={handleEditTx}
          />
        )}

        {currentTab === 'envelopes' && (
          <EnvelopesView
            onOpenTransfer={handleOpenTransfer}
            onOpenDeficit={handleOpenDeficit}
            onOpenRelease={handleOpenRelease}
            onOpenSurplus={handleOpenSurplus}
          />
        )}

        {currentTab === 'review' && (
          <ReviewView
            onOpenSurplus={handleOpenSurplus}
            onOpenDeficit={handleOpenDeficit}
          />
        )}

        {currentTab === 'reports' && <ReportsView />}

        {currentTab === 'settings' && (
          <SettingsView
            onOpenCloudGuide={() => setIsCloudGuideOpen(true)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Modals */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSave={async (data) => {
          if (editingTx) {
            await editTransaction({ ...editingTx, ...data })
          } else {
            await addTransaction(data)
          }
        }}
        initialType={txModalType}
        initialTransaction={editingTx}
        envelopes={envelopes}
        envelopeBalances={summary?.envelopes || []}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransfer={async (sourceId, targetId, amount, desc) => {
          await transferFunds(sourceId, targetId, amount, desc)
        }}
        envelopes={envelopes}
        envelopeBalances={summary?.envelopes || []}
        unallocatedCash={summary?.unallocatedCash || 0}
        defaultSourceId={transferSourceId}
        defaultTargetId={transferTargetId}
      />

      <DeficitModal
        isOpen={isDeficitModalOpen}
        onClose={() => setIsDeficitModalOpen(false)}
        deficitEnvelopeInfo={deficitInfo}
        allEnvelopeBalances={summary?.envelopes || []}
        onCoverManual={coverDeficitManually}
        onCoverAuto={coverDeficitAutomatically}
      />

      <ReleaseModal
        key={releaseTarget?.id ?? 'release'}
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        targetEnvelope={releaseTarget}
        poolEnvelope={releasePool}
        poolBalance={releasePoolBal}
        transfers={transfers}
        onRelease={releaseAllowance}
      />

      <SurplusModal
        isOpen={isSurplusModalOpen}
        onClose={() => setIsSurplusModalOpen(false)}
        sourceInfo={surplusSource}
        allEnvelopes={envelopes}
        onRouteSurplus={routeSurplus}
      />

      <SupabaseGuideModal
        isOpen={isCloudGuideOpen}
        onClose={() => setIsCloudGuideOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <AppContent />
      </FinanceProvider>
    </AuthProvider>
  )
}

export default App
