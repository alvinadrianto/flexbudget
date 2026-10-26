import type {
  DeficitRule,
  Envelope,
  FlexBudgetBackup,
  PeriodReview,
  Profile,
  Transaction,
  Transfer,
} from '../types/finance'

/**
 * Convert transactions array to downloadable CSV string
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  envelopes: Envelope[]
): string {
  const envelopeMap = new Map<string, string>()
  for (const env of envelopes) {
    envelopeMap.set(env.id, env.name)
  }

  const headers = ['ID', 'Tanggal', 'Tipe', 'Nominal (IDR)', 'Amplop/Kategori', 'Deskripsi', 'Catatan']
  const rows = transactions.map((t) => {
    const envelopeName = t.envelope_id ? envelopeMap.get(t.envelope_id) || 'Tidak Dikenal' : '-'
    return [
      t.id,
      t.date,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.amount.toString(),
      `"${envelopeName.replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\r\n')
}

/**
 * Convert transfers array to downloadable CSV string
 */
export function exportTransfersToCSV(
  transfers: Transfer[],
  envelopes: Envelope[]
): string {
  const envelopeMap = new Map<string, string>()
  for (const env of envelopes) {
    envelopeMap.set(env.id, env.name)
  }

  const headers = ['ID', 'Waktu', 'Tipe', 'Nominal (IDR)', 'Amplop Sumber', 'Amplop Tujuan', 'Deskripsi', 'Kunci Periode']
  const rows = transfers.map((tr) => {
    const src = tr.source_envelope_id ? envelopeMap.get(tr.source_envelope_id) || tr.source_envelope_id : 'Saldo Bebas (Unallocated)'
    const dst = tr.destination_envelope_id ? envelopeMap.get(tr.destination_envelope_id) || tr.destination_envelope_id : 'Saldo Bebas (Unallocated)'

    return [
      tr.id,
      tr.created_at,
      tr.type,
      tr.amount.toString(),
      `"${src.replace(/"/g, '""')}"`,
      `"${dst.replace(/"/g, '""')}"`,
      `"${(tr.description || '').replace(/"/g, '""')}"`,
      tr.period_key || '',
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\r\n')
}

/**
 * Create full JSON backup object
 */
export function createFullJSONBackup(params: {
  profile: Profile
  envelopes: Envelope[]
  transactions: Transaction[]
  transfers: Transfer[]
  deficitRules: DeficitRule[]
  periodReviews: PeriodReview[]
}): FlexBudgetBackup {
  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    profile: params.profile,
    envelopes: params.envelopes,
    transactions: params.transactions,
    transfers: params.transfers,
    deficit_rules: params.deficitRules,
    period_reviews: params.periodReviews,
  }
}

/**
 * Validate imported JSON backup structure
 */
export function validateJSONBackup(jsonString: string): {
  valid: boolean
  data?: FlexBudgetBackup
  error?: string
} {
  try {
    const parsed = JSON.parse(jsonString)

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'File backup tidak valid: format bukan JSON objek.' }
    }

    if (parsed.version !== '1.0') {
      return {
        valid: false,
        error: `Versi backup "${parsed.version}" tidak didukung. Aplikasi membutuhkan versi 1.0.`,
      }
    }

    if (!Array.isArray(parsed.envelopes) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.transfers)) {
      return {
        valid: false,
        error: 'Struktur backup tidak lengkap: envelopes, transactions, atau transfers hilang.',
      }
    }

    // Check transaction integers
    for (const tx of parsed.transactions) {
      if (typeof tx.amount !== 'number' || tx.amount <= 0 || !Number.isInteger(tx.amount)) {
        return {
          valid: false,
          error: `Transaksi "${tx.description || tx.id}" memiliki nominal tidak valid (harus integer positif).`,
        }
      }
    }

    return {
      valid: true,
      data: parsed as FlexBudgetBackup,
    }
  } catch (err) {
    return {
      valid: false,
      error: `Gagal mem-parsing file JSON: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Trigger file download in browser
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
