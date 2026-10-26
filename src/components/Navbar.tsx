import React from 'react'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  CalendarCheck,
  BarChart3,
  Settings,
  PlusCircle,
  Database,
  LogOut,
  WifiOff,
} from 'lucide-react'
import { formatRupiah } from '../services/financialEngine'
import { useAuth } from '../context/AuthContext'
import { useFinance } from '../context/FinanceContext'

export type NavTab = 'dashboard' | 'transactions' | 'envelopes' | 'review' | 'reports' | 'settings'

interface NavbarProps {
  currentTab: NavTab
  onSelectTab: (tab: NavTab) => void
  onOpenQuickAdd: (type: 'expense' | 'income') => void
  onOpenCloudGuide: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
  onOpenCloudGuide,
}) => {
  const { user, isSupabaseConnected, logout } = useAuth()
  const { summary, isOffline } = useFinance()

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transaksi', icon: Receipt },
    { id: 'envelopes', label: 'Amplop', icon: Wallet },
    { id: 'review', label: 'Tinjauan', icon: CalendarCheck },
    { id: 'reports', label: 'Laporan', icon: BarChart3 },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ]

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-950/80 backdrop-blur-xl h-screen sticky top-0 z-30 select-none">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-400 p-[2px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-indigo-400 text-lg">
                FB
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                FlexBudget
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                  PWA
                </span>
              </h1>
              <p className="text-xs text-slate-400">Kontrol Finansial</p>
            </div>
          </div>
        </div>

        {/* Balance Card Widget */}
        <div className="p-4 mx-4 my-3 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 shadow-inner">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">Saldo Terlacak</span>
            {isOffline ? (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                <WifiOff className="w-2.5 h-2.5" /> Offline
              </span>
            ) : isSupabaseConnected ? (
              <button
                onClick={onOpenCloudGuide}
                title="Tersambung ke Supabase Cloud"
                className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-full transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cloud RLS
              </button>
            ) : (
              <button
                onClick={onOpenCloudGuide}
                title="Klik untuk konfigurasi Supabase Cloud"
                className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-full transition-colors"
              >
                <Database className="w-2.5 h-2.5" />
                Mode Lokal
              </button>
            )}
          </div>
          <p className="text-xl font-bold tracking-tight text-white font-mono">
            {formatRupiah(summary?.trackedBalance || 0)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Saldo Bebas:</span>
            <span className={`font-mono font-semibold ${(summary?.unallocatedCash || 0) < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {formatRupiah(summary?.unallocatedCash || 0)}
            </span>
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="px-4 py-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => onOpenQuickAdd('expense')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all active:scale-95"
          >
            <span className="text-sm leading-none font-bold">-</span> Pengeluaran
          </button>
          <button
            onClick={() => onOpenQuickAdd('income')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all active:scale-95"
          >
            <span className="text-sm leading-none font-bold">+</span> Pemasukan
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.id === 'envelopes' && (summary?.deficitCount || 0) > 0 && (
                  <span className="ml-auto bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {summary?.deficitCount} defisit
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0">
              {user?.fullName?.charAt(0).toUpperCase() || 'P'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName || 'Pemilik'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || 'lokal'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Keluar"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MOBILE TOP HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 z-20 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 p-[1.5px]">
            <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center font-black text-indigo-400 text-xs">
              FB
            </div>
          </div>
          <span className="font-extrabold text-white text-sm">FlexBudget</span>
        </div>

        <div className="flex items-center gap-2">
          {isOffline ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              <WifiOff className="w-2.5 h-2.5" />
            </span>
          ) : (
            <button
              onClick={onOpenCloudGuide}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                isSupabaseConnected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
            >
              {isSupabaseConnected ? 'Cloud' : 'Lokal'}
            </button>
          )}

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block leading-none">Saldo</span>
            <span className="text-xs font-bold text-white font-mono leading-none">
              {formatRupiah(summary?.trackedBalance || 0)}
            </span>
          </div>

          {/* Logout button - only show when logged in via Supabase */}
          {isSupabaseConnected && user && (
            <button
              onClick={logout}
              title="Keluar"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 z-30 pb-safe">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            )
          })}

          {/* Quick Add Floating Center Button on Mobile */}
          <div className="flex justify-center -mt-5">
            <button
              onClick={() => onOpenQuickAdd('expense')}
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 border-2 border-slate-950 active:scale-90 transition-transform"
              title="Tambah Cepat"
            >
              <PlusCircle className="w-6 h-6" />
            </button>
          </div>

          {navItems.slice(2, 4).map((item) => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors relative ${
                  isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.id === 'envelopes' && (summary?.deficitCount || 0) > 0 && (
                  <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
