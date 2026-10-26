import React, { useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { FinanceProvider, useFinance } from './context/FinanceContext'
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
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        targetEnvelope={releaseTarget}
        poolEnvelope={releasePool}
        poolBalance={releasePoolBal}
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
