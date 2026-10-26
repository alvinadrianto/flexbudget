import React, { useState } from 'react'
import { X, Database, CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { isSupabaseConfigured } from '../services/supabaseClient'

interface SupabaseGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SupabaseGuideModal: React.FC<SupabaseGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  if (!isOpen) return null

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const steps = [
    {
      title: '1. Buat Proyek Supabase Gratis',
      desc: 'Buka supabase.com, login dan klik "New Project". Pilih region terdekat (misal: Singapore) untuk latensi terbaik.',
      link: 'https://supabase.com/dashboard',
    },
    {
      title: '2. Jalankan Migrasi SQL Database & RLS',
      desc: 'Buka SQL Editor di dashboard Supabase Anda, lalu salin dan jalankan seluruh isi skema dari file repositori:',
      code: 'supabase/migrations/20261026000000_flexbudget_schema.sql',
    },
    {
      title: '3. Ambil API Credentials',
      desc: 'Buka Project Settings -> API. Salin Project URL dan anon/public API Key. Masukkan ke file .env lokal atau Environment Variables di Cloudflare Pages:',
      code: `VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-public-key`,
    },
    {
      title: '4. Buat Akun Pemilik & Kunci Pendaftaran Publik',
      desc: 'Daftarkan akun email Anda melalui aplikasi ini. Setelah akun pemilik selesai dibuat, buka Authentication -> Providers -> Email di Supabase Dashboard, lalu matikan "Enable Signups" agar tidak ada orang asing yang bisa mendaftar.',
    },
    {
      title: '5. Deploy Gratis ke Cloudflare Pages',
      desc: 'Hubungkan repository Git ke Cloudflare Pages. Atur Build command: "npm run build" dan Output directory: "dist". Tambahkan variabel lingkungan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Panduan Koneksi Supabase & Deploy</h2>
              <p className="text-xs text-slate-400">Database PostgreSQL Mandiri dengan Row Level Security (RLS)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                isSupabaseConfigured ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div>
              <span className="text-xs font-bold text-white block">
                {isSupabaseConfigured ? 'Tersambung ke Supabase Cloud' : 'Mode Offline / Lokal Aktif'}
              </span>
              <span className="text-[11px] text-slate-400">
                {isSupabaseConfigured
                  ? 'Data tersimpan aman di PostgreSQL dengan RLS auth.uid()'
                  : 'Aplikasi berjalan menggunakan penyimpanan lokal browser'}
              </span>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
              isSupabaseConfigured
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            {isSupabaseConfigured ? 'Cloud Live' : 'Demo Mode'}
          </span>
        </div>

        {/* Checklist */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {steps.map((s, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-start justify-between">
                <span className="font-bold text-slate-200">{s.title}</span>
                {s.link && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:underline"
                  >
                    Buka <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">{s.desc}</p>
              {s.code && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-indigo-300">
                  <span className="truncate pr-2">{s.code}</span>
                  <button
                    onClick={() => copyToClipboard(s.code!, idx)}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors shrink-0"
                    title="Salin"
                  >
                    {copiedIndex === idx ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-800/80 mt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  )
}
