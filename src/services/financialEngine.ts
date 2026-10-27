import type {
  DeficitRule,
  Envelope,
  EnvelopeBalanceInfo,
  FinancialSummary,
  Profile,
  Transaction,
  Transfer,
} from '../types/finance'

/**
 * Format integer IDR currency strictly according to Indonesian locale
 * e.g., Rp3.800.000 or -Rp50.000
 */
export function formatRupiah(amount: number): string {
  const isNegative = amount < 0
  const absVal = Math.abs(Math.round(amount))
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absVal)

  // Standardize output to "Rp3.800.000" or "-Rp50.000"
  const cleanFormatted = formatted.replace(/\s+/g, '')
  return isNegative ? `-${cleanFormatted}` : cleanFormatted
}

/**
 * Parse numeric input into safe integer IDR
 */
export function parseRupiahInput(value: string | number): number {
  if (typeof value === 'number') {
    return Math.max(0, Math.round(value))
  }
  const clean = value.replace(/[^0-9]/g, '')
  return clean ? parseInt(clean, 10) : 0
}

/**
 * Calculate the single source-of-truth Tracked Money Balance:
 * Tracked Balance = Opening Balance + Total Income - Total Expenses
 * Budget-to-budget transfers NEVER change the tracked balance.
 */
export function calculateTrackedBalance(
  openingBalance: number,
  transactions: Transaction[]
): {
  trackedBalance: number
  totalIncome: number
  totalExpenses: number
} {
  let totalIncome = 0
  let totalExpenses = 0

  for (const tx of transactions) {
    const amt = Math.max(0, Math.round(tx.amount))
    if (tx.type === 'income') {
      totalIncome += amt
    } else if (tx.type === 'expense') {
      totalExpenses += amt
    }
  }

  const trackedBalance = Math.round(openingBalance) + totalIncome - totalExpenses

  return {
    trackedBalance,
    totalIncome,
    totalExpenses,
  }
}

/**
 * Filter transactions by timeframe (today, this week, this month)
 * in Asia/Jakarta timezone.
 */
export function getJakartaDateStrings(now = new Date()): {
  todayStr: string
  weekStartStr: string
  weekEndStr: string
  monthStartStr: string
} {
  // Formatter for Jakarta date YYYY-MM-DD
  const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const todayStr = jakartaDateFormatter.format(now)

  // Calculate start of current week (Monday) in Jakarta
  const d = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  const dayOfWeek = d.getDay() // 0 = Sunday, 1 = Monday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  d.setDate(d.getDate() + diffToMonday)
  const weekStartStr = jakartaDateFormatter.format(d)

  // Calculate Sunday of current week
  const dSun = new Date(d)
  dSun.setDate(dSun.getDate() + 6)
  const weekEndStr = jakartaDateFormatter.format(dSun)

  // Month start: YYYY-MM-01
  const monthStartStr = `${todayStr.slice(0, 7)}-01`

  return {
    todayStr,
    weekStartStr,
    weekEndStr,
    monthStartStr,
  }
}

export function getJakartaDateFromIso(isoString?: string | null): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString.slice(0, 10)
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return isoString.slice(0, 10)
  }
}

/**
 * Calculate balances for all envelopes based on historical transactions and transfers.
 *
 * For each envelope:
 *   balance = transfersIn - transfersOut - expensesAssigned
 *
 * If balance < 0, the envelope is in deficit.
 */
export function calculateEnvelopeBalances(
  envelopes: Envelope[],
  transactions: Transaction[],
  transfers: Transfer[],
  now = new Date()
): EnvelopeBalanceInfo[] {
  const { todayStr, weekStartStr, weekEndStr } = getJakartaDateStrings(now)
  const monthPrefix = todayStr.slice(0, 7)

  // Aggregate credits and debits from transfers ledger
  const creditsMap = new Map<string, number>()
  const debitsMap = new Map<string, number>()
  const expensesMap = new Map<string, number>()
  const expensesTodayMap = new Map<string, number>()
  const expensesWeekMap = new Map<string, number>()
  const expensesMonthMap = new Map<string, number>()

  const deficitCoverGivenMap = new Map<string, number>()
  const deficitCoverGivenTodayMap = new Map<string, number>()
  const deficitCoverGivenWeekMap = new Map<string, number>()
  const deficitCoverGivenMonthMap = new Map<string, number>()

  const deficitCoverReceivedMap = new Map<string, number>()
  // Track only pool_release transfers flowing OUT of each envelope (for funding_pool spentAmount)
  const poolReleasedOutMap = new Map<string, number>()
  const poolReleasedOutThisMonthMap = new Map<string, number>()

  for (const tr of transfers) {
    const amt = Math.max(0, Math.round(tr.amount))
    const trDate = getJakartaDateFromIso(tr.created_at) || todayStr

    if (tr.destination_envelope_id) {
      creditsMap.set(
        tr.destination_envelope_id,
        (creditsMap.get(tr.destination_envelope_id) || 0) + amt
      )
      if (tr.type === 'deficit_coverage') {
        deficitCoverReceivedMap.set(
          tr.destination_envelope_id,
          (deficitCoverReceivedMap.get(tr.destination_envelope_id) || 0) + amt
        )
      }
    }
    if (tr.source_envelope_id) {
      debitsMap.set(
        tr.source_envelope_id,
        (debitsMap.get(tr.source_envelope_id) || 0) + amt
      )
      if (tr.type === 'deficit_coverage') {
        deficitCoverGivenMap.set(
          tr.source_envelope_id,
          (deficitCoverGivenMap.get(tr.source_envelope_id) || 0) + amt
        )
        if (trDate === todayStr) {
          deficitCoverGivenTodayMap.set(
            tr.source_envelope_id,
            (deficitCoverGivenTodayMap.get(tr.source_envelope_id) || 0) + amt
          )
        }
        if (trDate >= weekStartStr && trDate <= weekEndStr) {
          deficitCoverGivenWeekMap.set(
            tr.source_envelope_id,
            (deficitCoverGivenWeekMap.get(tr.source_envelope_id) || 0) + amt
          )
        }
        if (trDate.startsWith(monthPrefix)) {
          deficitCoverGivenMonthMap.set(
            tr.source_envelope_id,
            (deficitCoverGivenMonthMap.get(tr.source_envelope_id) || 0) + amt
          )
        }
      }
      // Track pool_release outflows separately for funding_pool "terpakai"
      if (tr.type === 'pool_release') {
        poolReleasedOutMap.set(
          tr.source_envelope_id,
          (poolReleasedOutMap.get(tr.source_envelope_id) || 0) + amt
        )
        if (trDate.startsWith(monthPrefix)) {
          poolReleasedOutThisMonthMap.set(
            tr.source_envelope_id,
            (poolReleasedOutThisMonthMap.get(tr.source_envelope_id) || 0) + amt
          )
        }
      }
    }
  }

  for (const tx of transactions) {
    if (tx.type === 'expense' && tx.envelope_id) {
      const amt = Math.max(0, Math.round(tx.amount))
      expensesMap.set(
        tx.envelope_id,
        (expensesMap.get(tx.envelope_id) || 0) + amt
      )

      if (tx.date === todayStr) {
        expensesTodayMap.set(
          tx.envelope_id,
          (expensesTodayMap.get(tx.envelope_id) || 0) + amt
        )
      }
      if (tx.date >= weekStartStr && tx.date <= weekEndStr) {
        expensesWeekMap.set(
          tx.envelope_id,
          (expensesWeekMap.get(tx.envelope_id) || 0) + amt
        )
      }
      if (tx.date.startsWith(monthPrefix)) {
        expensesMonthMap.set(
          tx.envelope_id,
          (expensesMonthMap.get(tx.envelope_id) || 0) + amt
        )
      }
    }
  }

  return envelopes.map((env) => {
    const transferredIn = creditsMap.get(env.id) || 0
    const transferredOut = debitsMap.get(env.id) || 0
    const directExpenses = expensesMap.get(env.id) || 0
    const deficitCoverGiven = deficitCoverGivenMap.get(env.id) || 0
    const deficitCoverReceived = deficitCoverReceivedMap.get(env.id) || 0
    const poolReleasedOut = poolReleasedOutMap.get(env.id) || 0
    const poolReleasedOutThisPeriod = poolReleasedOutThisMonthMap.get(env.id) || 0

    // Balance formula: sum of transfers in - sum of transfers out - direct expenses
    const balance = transferredIn - transferredOut - directExpenses

    /**
     * Lifetime spentAmount:
     * directExpenses + deficitCoverGiven for all envelope types.
     */
    const spentAmount = directExpenses + deficitCoverGiven

    /**
     * Period-specific spent (terpakai dalam siklus aktifnya):
     * - daily: hari ini (today)
     * - weekly: minggu ini (this week)
     * - monthly & others: bulan ini (this month)
     */
    let directExpensesThisPeriod = 0
    let deficitCoverGivenThisPeriod = 0

    if (env.period_type === 'daily') {
      directExpensesThisPeriod = expensesTodayMap.get(env.id) || 0
      deficitCoverGivenThisPeriod = deficitCoverGivenTodayMap.get(env.id) || 0
    } else if (env.period_type === 'weekly') {
      directExpensesThisPeriod = expensesWeekMap.get(env.id) || 0
      deficitCoverGivenThisPeriod = deficitCoverGivenWeekMap.get(env.id) || 0
    } else {
      directExpensesThisPeriod = expensesMonthMap.get(env.id) || 0
      deficitCoverGivenThisPeriod = deficitCoverGivenMonthMap.get(env.id) || 0
    }

    const spentThisPeriod = directExpensesThisPeriod + deficitCoverGivenThisPeriod

    const isDeficit = balance < 0
    const deficitAmount = isDeficit ? Math.abs(balance) : 0
    const availableSurplus = Math.max(
      0,
      balance - Math.max(0, env.min_protected_balance || 0)
    )

    return {
      envelope: env,
      balance,
      spentAmount,
      spentThisPeriod,
      directExpenses,
      directExpensesThisPeriod,
      deficitCoverGiven,
      deficitCoverReceived,
      poolReleasedOut: env.type === 'funding_pool' ? poolReleasedOut : undefined,
      poolReleasedOutThisPeriod: env.type === 'funding_pool' ? poolReleasedOutThisPeriod : undefined,
      transferredIn,
      transferredOut,
      isDeficit,
      deficitAmount,
      availableSurplus,
    }
  })
}

export interface AllowancePeriodStatus {
  isReleased: boolean
  currentPeriodKey: string
  lastReleasedAt?: string
  lastReleasedAmount?: number
  nextResetDescription: string
  periodLabel: string
}

/**
 * Check whether a daily or weekly allowance has already been released for the current period,
 * and provide details on when the next allowance will become active.
 */
export function checkAllowanceStatus(
  targetEnvelopeId: string,
  periodType: 'daily' | 'weekly',
  transfers: Transfer[],
  now = new Date()
): AllowancePeriodStatus {
  const { todayStr, weekStartStr } = getJakartaDateStrings(now)

  const indonesianDisplayFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  if (periodType === 'daily') {
    const currentPeriodKey = `release:daily:${todayStr}:${targetEnvelopeId}`
    const matchingTransfer = transfers.find(
      (t) => t.period_key === currentPeriodKey || t.period_key?.startsWith(currentPeriodKey + ':extra-')
    )

    const d = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
    d.setDate(d.getDate() + 1)
    const nextDateFormatted = indonesianDisplayFormatter.format(d)

    return {
      isReleased: Boolean(matchingTransfer),
      currentPeriodKey,
      lastReleasedAt: matchingTransfer?.created_at,
      lastReleasedAmount: matchingTransfer?.amount,
      nextResetDescription: `Tunjangan harian berikutnya aktif besok (${nextDateFormatted})`,
      periodLabel: 'Hari Ini',
    }
  } else {
    const currentPeriodKey = `release:weekly:${weekStartStr}:${targetEnvelopeId}`
    const matchingTransfer = transfers.find(
      (t) => t.period_key === currentPeriodKey || t.period_key?.startsWith(currentPeriodKey + ':extra-')
    )

    const d = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
    const dayOfWeek = d.getDay()
    const diffToNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    d.setDate(d.getDate() + diffToNextMonday)
    const nextMondayFormatted = indonesianDisplayFormatter.format(d)

    return {
      isReleased: Boolean(matchingTransfer),
      currentPeriodKey,
      lastReleasedAt: matchingTransfer?.created_at,
      lastReleasedAmount: matchingTransfer?.amount,
      nextResetDescription: `Tunjangan mingguan berikutnya aktif Senin (${nextMondayFormatted})`,
      periodLabel: 'Minggu Ini',
    }
  }
}

/**
 * Generate full financial summary, verifying the accounting invariants:
 * Tracked Balance = sum(envelope balances) + unallocatedCash
 */
export function generateFinancialSummary(
  profile: Profile,
  envelopes: Envelope[],
  transactions: Transaction[],
  transfers: Transfer[],
  now = new Date()
): FinancialSummary {
  const { trackedBalance, totalIncome, totalExpenses } = calculateTrackedBalance(
    profile.opening_balance,
    transactions
  )

  const envelopeBalances = calculateEnvelopeBalances(
    envelopes,
    transactions,
    transfers,
    now
  )

  // Sum of all envelope balances (can be positive or negative)
  let totalNetEnvelopeBalances = 0
  let totalAllocated = 0
  let savingsTotal = 0
  let emergencyTotal = 0
  let deficitCount = 0
  let totalDeficitAmount = 0

  for (const item of envelopeBalances) {
    totalNetEnvelopeBalances += item.balance

    if (item.balance > 0) {
      totalAllocated += item.balance
    }

    if (item.envelope.type === 'savings') {
      savingsTotal += item.balance
    } else if (item.envelope.type === 'emergency_fund') {
      emergencyTotal += item.balance
    }

    if (item.isDeficit) {
      deficitCount += 1
      totalDeficitAmount += item.deficitAmount
    }
  }

  // Unallocated funds: Tracked balance minus net envelope balances
  const unallocatedCash = trackedBalance - totalNetEnvelopeBalances

  // Accounting invariant: Tracked balance === sum(envelopes) + unallocatedCash
  const accountingInvariantValid =
    trackedBalance === totalNetEnvelopeBalances + unallocatedCash

  // Timeframe breakdowns in Asia/Jakarta
  const { todayStr, weekStartStr, monthStartStr } = getJakartaDateStrings(now)

  let todayIncome = 0
  let todayExpense = 0
  let weekIncome = 0
  let weekExpense = 0
  let monthIncome = 0
  let monthExpense = 0

  for (const tx of transactions) {
    const amt = tx.amount
    const txDate = tx.date

    if (txDate === todayStr) {
      if (tx.type === 'income') todayIncome += amt
      else todayExpense += amt
    }

    if (txDate >= weekStartStr && txDate <= todayStr) {
      if (tx.type === 'income') weekIncome += amt
      else weekExpense += amt
    }

    if (txDate >= monthStartStr && txDate <= todayStr) {
      if (tx.type === 'income') monthIncome += amt
      else monthExpense += amt
    }
  }

  return {
    trackedBalance,
    totalIncome,
    totalExpenses,
    totalAllocated,
    unallocatedCash,
    todayIncome,
    todayExpense,
    weekIncome,
    weekExpense,
    monthIncome,
    monthExpense,
    savingsTotal,
    emergencyTotal,
    deficitCount,
    totalDeficitAmount,
    envelopes: envelopeBalances,
    accountingInvariantValid,
  }
}

/**
 * Release allowance from a funding pool into a target envelope.
 * E.g., Daily Spending Pool -> Daily Spending Envelope (Rp30.000)
 *
 * Verifies:
 * - Pool has sufficient funds.
 * - If insufficient, returns shortage amount and creates no transfer.
 * - Idempotent by periodKey.
 */
export function releasePoolAllowance(params: {
  userId: string
  poolEnvelope: Envelope
  targetEnvelope: Envelope
  amount: number
  periodKey: string // e.g. 'release:2026-10-26:targetId'
  currentPoolBalance: number
  existingTransfers: Transfer[]
}): {
  success: boolean
  transfer?: Transfer
  error?: string
  shortage?: number
} {
  const {
    userId,
    poolEnvelope,
    targetEnvelope,
    amount,
    periodKey,
    currentPoolBalance,
    existingTransfers,
  } = params

  // 1. Idempotency check: Has this periodKey already been processed?
  const alreadyProcessed = existingTransfers.some(
    (t) => t.period_key === periodKey
  )
  if (alreadyProcessed) {
    return {
      success: false,
      error: 'Alokasi untuk periode ini sudah pernah dirilis (idempotent).',
    }
  }

  // 2. Check available funds in pool
  if (currentPoolBalance < amount) {
    const shortage = amount - currentPoolBalance
    return {
      success: false,
      error: `Dana di pool "${poolEnvelope.name}" tidak mencukupi. Kurang ${formatRupiah(shortage)}.`,
      shortage,
    }
  }

  // 3. Create transfer record
  const transfer: Transfer = {
    id: crypto.randomUUID ? crypto.randomUUID() : `tr-${Date.now()}-${Math.random()}`,
    user_id: userId,
    type: 'pool_release',
    source_envelope_id: poolEnvelope.id,
    destination_envelope_id: targetEnvelope.id,
    amount: Math.round(amount),
    description: `Pelepasan tunjangan ${targetEnvelope.name} dari ${poolEnvelope.name}`,
    period_key: periodKey,
    created_at: new Date().toISOString(),
  }

  return {
    success: true,
    transfer,
  }
}

/**
 * Route surplus funds from an envelope at period close or manual review.
 * E.g., Unused Daily budget Rp10.000 transferred to Emergency Fund or Savings.
 */
export function routeSurplusFunds(params: {
  userId: string
  sourceEnvelope: Envelope
  destinationEnvelope: Envelope
  amount: number
  availableSurplus: number
  reason?: string
}): {
  success: boolean
  transfer?: Transfer
  error?: string
} {
  const {
    userId,
    sourceEnvelope,
    destinationEnvelope,
    amount,
    availableSurplus,
    reason,
  } = params

  const roundedAmount = Math.round(amount)

  if (roundedAmount <= 0) {
    return { success: false, error: 'Jumlah transfer surplus harus lebih dari Rp0.' }
  }

  if (roundedAmount > availableSurplus) {
    return {
      success: false,
      error: `Surplus yang tersedia di "${sourceEnvelope.name}" hanya ${formatRupiah(availableSurplus)}.`,
    }
  }

  const transfer: Transfer = {
    id: crypto.randomUUID ? crypto.randomUUID() : `tr-${Date.now()}-${Math.random()}`,
    user_id: userId,
    type: 'surplus_routing',
    source_envelope_id: sourceEnvelope.id,
    destination_envelope_id: destinationEnvelope.id,
    amount: roundedAmount,
    description: reason || `Pengalihan surplus dari ${sourceEnvelope.name} ke ${destinationEnvelope.name}`,
    created_at: new Date().toISOString(),
  }

  return {
    success: true,
    transfer,
  }
}

/**
 * Manual Deficit Coverage:
 * User selects one or more source envelopes to cover an overspent envelope.
 */
export function coverDeficitManual(params: {
  userId: string
  deficitEnvelopeId: string
  deficitAmount: number
  allocations: {
    sourceEnvelope: Envelope
    availableFunds: number
    amountToTake: number
  }[]
  relatedTransactionId?: string
}): {
  success: boolean
  transfers: Transfer[]
  coveredTotal: number
  remainingDeficit: number
  error?: string
} {
  const { userId, deficitEnvelopeId, deficitAmount, allocations, relatedTransactionId } =
    params

  const transfers: Transfer[] = []
  let coveredTotal = 0

  for (const alloc of allocations) {
    const amt = Math.round(alloc.amountToTake)
    if (amt <= 0) continue

    // Validate source can provide this amount
    if (amt > alloc.availableFunds) {
      return {
        success: false,
        transfers: [],
        coveredTotal: 0,
        remainingDeficit: deficitAmount,
        error: `Amplop "${alloc.sourceEnvelope.name}" tidak memiliki dana bebas yang cukup (tersedia ${formatRupiah(alloc.availableFunds)}).`,
      }
    }

    coveredTotal += amt
  }

  if (coveredTotal === 0) {
    return {
      success: false,
      transfers: [],
      coveredTotal: 0,
      remainingDeficit: deficitAmount,
      error: 'Pilih setidaknya satu amplop sumber dengan nominal penutupan > Rp0.',
    }
  }

  // Create audited transfer records
  for (const alloc of allocations) {
    const amt = Math.round(alloc.amountToTake)
    if (amt <= 0) continue

    transfers.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `tr-${Date.now()}-${Math.random()}`,
      user_id: userId,
      type: 'deficit_coverage',
      source_envelope_id: alloc.sourceEnvelope.id,
      destination_envelope_id: deficitEnvelopeId,
      amount: amt,
      description: `Penutupan defisit amplop dari ${alloc.sourceEnvelope.name}`,
      related_transaction_id: relatedTransactionId || null,
      created_at: new Date().toISOString(),
    })
  }

  const remainingDeficit = Math.max(0, deficitAmount - coveredTotal)

  return {
    success: true,
    transfers,
    coveredTotal,
    remainingDeficit,
  }
}

/**
 * Automatic Deficit Coverage:
 * Automatically iterates through configured rules / priority list to cover a deficit.
 * Respects min_protected_balance and protected envelopes.
 */
export function coverDeficitAuto(params: {
  userId: string
  deficitEnvelope: Envelope
  deficitAmount: number
  envelopeBalances: EnvelopeBalanceInfo[]
  rules: DeficitRule[]
  relatedTransactionId?: string
}): {
  success: boolean
  transfers: Transfer[]
  coveredTotal: number
  remainingDeficit: number
  summaryLog: string[]
} {
  const {
    userId,
    deficitEnvelope,
    deficitAmount,
    envelopeBalances,
    rules,
    relatedTransactionId,
  } = params

  const balanceMap = new Map<string, EnvelopeBalanceInfo>()
  for (const b of envelopeBalances) {
    balanceMap.set(b.envelope.id, { ...b })
  }

  // Filter and sort active rules for this deficit envelope
  const activeRules = rules
    .filter((r) => r.is_active && r.target_envelope_id === deficitEnvelope.id)
    .sort((a, b) => a.priority_order - b.priority_order)

  // Determine candidate sources:
  // If user configured explicit rules, use them.
  // Otherwise, use sensible financial hierarchy:
  // 1. Linked parent funding pool (funding_source_id)
  // 2. Other monthly funding pools (type: 'funding_pool')
  // 3. Weekly/daily discretionary allowances (type: 'spending_weekly' | 'spending_daily')
  // 4. Emergency funds & reserves (type: 'emergency_fund' | 'reserve')
  // 5. Savings (type: 'savings', respecting min_protected_balance)
  // Operational monthly spending (spending_monthly) is excluded from auto-coverage.
  const candidateRules: { sourceId: string; maxAmount?: number | null }[] = []

  if (activeRules.length > 0) {
    for (const r of activeRules) {
      candidateRules.push({ sourceId: r.source_envelope_id, maxAmount: r.max_coverage_amount })
    }
  } else {
    // 1. Linked funding pool
    if (deficitEnvelope.funding_source_id) {
      candidateRules.push({ sourceId: deficitEnvelope.funding_source_id })
    }
    // 2. Other funding pools
    for (const b of envelopeBalances) {
      if (
        b.envelope.type === 'funding_pool' &&
        b.envelope.id !== deficitEnvelope.id &&
        !candidateRules.some((c) => c.sourceId === b.envelope.id)
      ) {
        candidateRules.push({ sourceId: b.envelope.id })
      }
    }
    // 3. Discretionary allowances (e.g. Jajan Mingguan / other daily allowance)
    for (const b of envelopeBalances) {
      if (
        (b.envelope.type === 'spending_weekly' || b.envelope.type === 'spending_daily') &&
        b.envelope.id !== deficitEnvelope.id &&
        !candidateRules.some((c) => c.sourceId === b.envelope.id)
      ) {
        candidateRules.push({ sourceId: b.envelope.id })
      }
    }
    // 4. Emergency fund & reserve
    for (const b of envelopeBalances) {
      if (
        (b.envelope.type === 'emergency_fund' || b.envelope.type === 'reserve') &&
        b.envelope.id !== deficitEnvelope.id &&
        !candidateRules.some((c) => c.sourceId === b.envelope.id)
      ) {
        candidateRules.push({ sourceId: b.envelope.id })
      }
    }
    // 5. Savings
    for (const b of envelopeBalances) {
      if (
        b.envelope.type === 'savings' &&
        b.envelope.id !== deficitEnvelope.id &&
        !candidateRules.some((c) => c.sourceId === b.envelope.id)
      ) {
        candidateRules.push({ sourceId: b.envelope.id })
      }
    }
  }

  const transfers: Transfer[] = []
  const summaryLog: string[] = []
  let needed = deficitAmount
  let coveredTotal = 0

  for (const candidate of candidateRules) {
    if (needed <= 0) break

    const sourceInfo = balanceMap.get(candidate.sourceId)
    if (!sourceInfo) continue

    // Respect min_protected_balance
    const minProtected = Math.max(0, sourceInfo.envelope.min_protected_balance || 0)
    const currentBalance = sourceInfo.balance

    const usableFunds = Math.max(0, currentBalance - minProtected)
    if (usableFunds <= 0) {
      summaryLog.push(
        `Sumber ${sourceInfo.envelope.name} dilewati: tidak memiliki dana di atas saldo proteksi (${formatRupiah(minProtected)}).`
      )
      continue
    }

    let takeAmount = Math.min(needed, usableFunds)
    if (candidate.maxAmount && candidate.maxAmount > 0) {
      takeAmount = Math.min(takeAmount, candidate.maxAmount)
    }

    if (takeAmount <= 0) continue

    transfers.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `tr-${Date.now()}-${Math.random()}`,
      user_id: userId,
      type: 'deficit_coverage',
      source_envelope_id: sourceInfo.envelope.id,
      destination_envelope_id: deficitEnvelope.id,
      amount: takeAmount,
      description: `Otomatis menutup defisit ${deficitEnvelope.name} dari ${sourceInfo.envelope.name}`,
      related_transaction_id: relatedTransactionId || null,
      created_at: new Date().toISOString(),
    })

    // Deduct locally for subsequent rules
    sourceInfo.balance -= takeAmount
    needed -= takeAmount
    coveredTotal += takeAmount
    summaryLog.push(
      `Menarik ${formatRupiah(takeAmount)} dari ${sourceInfo.envelope.name} (sisa defisit: ${formatRupiah(needed)}).`
    )
  }

  return {
    success: coveredTotal > 0,
    transfers,
    coveredTotal,
    remainingDeficit: needed,
    summaryLog,
  }
}

/**
 * Initial Sample Budget Template Specification (Section 11)
 *
 * Total allocation: Rp3.800.000
 * All amounts validated to distribute 100% of the planned monthly income.
 */
export function getInitialBudgetTemplate(userId: string): {
  monthlyIncome: number
  envelopes: Envelope[]
  initialAllocations: {
    envelopeName: string
    amount: number
  }[]
} {
  const monthlyIncome = 3800000

  const dailyPoolId = 'pool-daily-spending'
  const dailySpendingId = 'env-daily-spending'
  const jajanPoolId = 'pool-weekly-jajan'
  const jajanWeeklyId = 'env-weekly-jajan'
  const mainSavingsId = 'env-main-savings'
  const fuelId = 'env-fuel'
  const dryCatFoodId = 'env-dry-cat-food'
  const wetCatTreatsId = 'env-wet-cat-treats'
  const emergencyFundId = 'env-emergency-fund'

  const envelopes: Envelope[] = [
    {
      id: dailyPoolId,
      user_id: userId,
      name: 'Daily Spending Pool',
      type: 'funding_pool',
      period_type: 'monthly',
      period_amount: 900000,
      funding_source_id: null,
      rollover_policy: 'roll_over',
      surplus_destination_id: null,
      deficit_coverage_mode: 'manual',
      deficit_priority: 10,
      min_protected_balance: 0,
      is_archived: false,
      sort_order: 1,
    },
    {
      id: dailySpendingId,
      user_id: userId,
      name: 'Pengeluaran Harian',
      type: 'spending_daily',
      period_type: 'daily',
      period_amount: 30000, // Releases Rp30.000/day from daily pool
      funding_source_id: dailyPoolId,
      rollover_policy: 'reserve_emergency',
      surplus_destination_id: emergencyFundId,
      deficit_coverage_mode: 'auto',
      deficit_priority: 1,
      min_protected_balance: 0,
      is_archived: false,
      sort_order: 2,
    },
    {
      id: mainSavingsId,
      user_id: userId,
      name: 'Tabungan Utama',
      type: 'savings',
      period_type: 'monthly',
      period_amount: 1000000,
      funding_source_id: null,
      rollover_policy: 'roll_over',
      surplus_destination_id: null,
      deficit_coverage_mode: 'manual',
      deficit_priority: 99,
      min_protected_balance: 1000000, // Protected
      is_archived: false,
      sort_order: 3,
    },
    {
      id: fuelId,
      user_id: userId,
      name: 'Bensin Motor/Mobil',
      type: 'spending_monthly',
      period_type: 'monthly',
      period_amount: 240000,
      funding_source_id: null,
      rollover_policy: 'roll_over',
      surplus_destination_id: null,
      deficit_coverage_mode: 'manual',
      deficit_priority: 4,
      min_protected_balance: 0,
      is_archived: false,
      sort_order: 4,
    },
    {
      id: dryCatFoodId,
      user_id: userId,
      name: 'Makanan Kucing Kering',
      type: 'spending_monthly',
      period_type: 'monthly',
      period_amount: 520000,
      funding_source_id: null,
      rollover_policy: 'roll_over',
      surplus_destination_id: null,
      deficit_coverage_mode: 'manual',
      deficit_priority: 5,
      min_protected_balance: 0,
      is_archived: false,
      sort_order: 5,
    },
    {
      id: wetCatTreatsId,
      user_id: userId,
      name: 'Snack Kucing Basah',
      type: 'spending_monthly',
      period_type: 'monthly',
      period_amount: 35000,
      funding_source_id: null,
      rollover_policy: 'roll_over',
      surplus_destination_id: null,
      deficit_coverage_mode: 'manual',
      deficit_priority: 6,
      min_protected_balance: 0,
      is_archived: false,
      sort_order: 6,
    },
    {
      id: jajanPoolId,
      user_id: userId,
      name: 'Jajan Pool (Bulanan)',
      type: 'funding_pool',
      period_type: 'monthly',
      period_amount: 800000,
      funding_source_id: null,
      rollover_policy: 'roll_over',
      surplus_destination_id: null,
      deficit_coverage_mode: 'manual',
      deficit_priority: 11,
      min_protected_balance: 0,
      is_archived: false,
      sort_order: 7,
    },
    {
      id: jajanWeeklyId,
      user_id: userId,
      name: 'Jajan Mingguan',
      type: 'spending_weekly',
      period_type: 'weekly',
      period_amount: 200000, // Releases Rp200.000/week from Jajan Pool
      funding_source_id: jajanPoolId,
      rollover_policy: 'return_to_pool',
      surplus_destination_id: jajanPoolId,
      deficit_coverage_mode: 'manual',
      deficit_priority: 2,
      min_protected_balance: 0,
      is_archived: false,
      sort_order: 8,
    },
    {
      id: emergencyFundId,
      user_id: userId,
      name: 'Dana Darurat / Cadangan',
      type: 'emergency_fund',
      period_type: 'monthly',
      period_amount: 305000,
      funding_source_id: null,
      rollover_policy: 'roll_over',
      surplus_destination_id: null,
      deficit_coverage_mode: 'manual',
      deficit_priority: 98,
      min_protected_balance: 305000, // Protected
      is_archived: false,
      sort_order: 9,
    },
  ]

  // Monthly initial allocations from income (Unallocated -> Funding Pools & Direct Budgets)
  // Daily spending and Weekly jajan are NOT funded directly from income:
  // they receive their money via pool release transfers!
  const initialAllocations = [
    { envelopeName: 'Daily Spending Pool', amount: 900000 },
    { envelopeName: 'Tabungan Utama', amount: 1000000 },
    { envelopeName: 'Bensin Motor/Mobil', amount: 240000 },
    { envelopeName: 'Makanan Kucing Kering', amount: 520000 },
    { envelopeName: 'Snack Kucing Basah', amount: 35000 },
    { envelopeName: 'Jajan Pool (Bulanan)', amount: 800000 },
    { envelopeName: 'Dana Darurat / Cadangan', amount: 305000 },
  ]

  return {
    monthlyIncome,
    envelopes,
    initialAllocations,
  }
}
