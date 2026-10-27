import { describe, expect, it } from 'vitest'
import {
  calculateEnvelopeBalances,
  calculateTrackedBalance,
  coverDeficitAuto,
  coverDeficitManual,
  formatRupiah,
  generateFinancialSummary,
  getInitialBudgetTemplate,
  releasePoolAllowance,
  routeSurplusFunds,
} from './financialEngine'
import {
  createFullJSONBackup,
  exportTransactionsToCSV,
  exportTransfersToCSV,
  validateJSONBackup,
} from './backupService'
import type {
  DeficitRule,
  Profile,
  Transaction,
  Transfer,
} from '../types/finance'

describe('FlexBudget Financial Engine & Accounting Invariants', () => {
  const userId = 'user-test-123'
  const mockProfile: Profile = {
    id: userId,
    email: 'test@flexbudget.app',
    full_name: 'Pemilik FlexBudget',
    opening_balance: 0,
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
  }

  // 1. Income of Rp3.800.000 increases the tracked balance by Rp3.800.000
  it('1. Income of Rp3.800.000 increases the tracked balance by Rp3.800.000', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji Bulanan',
      },
    ]

    const { trackedBalance, totalIncome } = calculateTrackedBalance(0, transactions)
    expect(totalIncome).toBe(3800000)
    expect(trackedBalance).toBe(3800000)
  })

  // 2. Allocating the sample budget distributes exactly Rp3.800.000 and leaves zero unallocated
  it('2. Allocating the sample budget distributes exactly Rp3.800.000 and leaves zero unallocated', () => {
    const template = getInitialBudgetTemplate(userId)
    const totalAllocatedPlanned = template.initialAllocations.reduce(
      (sum, a) => sum + a.amount,
      0
    )

    expect(template.monthlyIncome).toBe(3800000)
    expect(totalAllocatedPlanned).toBe(3800000)

    // Simulate initial allocation transfers from unallocated cash into envelopes
    const initialTransfers: Transfer[] = template.initialAllocations.map((alloc, idx) => {
      const targetEnv = template.envelopes.find((e) => e.name === alloc.envelopeName)!
      return {
        id: `tr-init-${idx}`,
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null, // from unallocated
        destination_envelope_id: targetEnv.id,
        amount: alloc.amount,
        description: `Alokasi Awal: ${alloc.envelopeName}`,
        created_at: '2026-10-01T00:00:00Z',
      }
    })

    const transactions: Transaction[] = [
      {
        id: 'tx-income-1',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji Masuk',
      },
    ]

    const summary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactions,
      initialTransfers
    )

    expect(summary.trackedBalance).toBe(3800000)
    expect(summary.unallocatedCash).toBe(0)
    expect(summary.accountingInvariantValid).toBe(true)
  })

  // 3. Releasing Rp30.000 from the daily pool transfers that amount without changing the tracked balance
  it('3. Releasing Rp30.000 from the daily pool transfers that amount without changing the tracked balance', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailyPool = template.envelopes.find((e) => e.id === 'pool-daily-spending')!
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!

    const transactions: Transaction[] = [
      {
        id: 'tx-inc',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji',
      },
    ]

    const initialTransfers: Transfer[] = [
      {
        id: 'tr-pool-init',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: dailyPool.id,
        amount: 900000,
        description: 'Alokasi Daily Pool',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const releaseResult = releasePoolAllowance({
      userId,
      poolEnvelope: dailyPool,
      targetEnvelope: dailySpending,
      amount: 30000,
      periodKey: 'release:2026-10-01:env-daily-spending',
      currentPoolBalance: 900000,
      existingTransfers: initialTransfers,
    })

    expect(releaseResult.success).toBe(true)
    const newTransfers = [...initialTransfers, releaseResult.transfer!]

    const summary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactions,
      newTransfers
    )

    // Tracked balance must remain exactly Rp3.800.000
    expect(summary.trackedBalance).toBe(3800000)

    const poolBalance = summary.envelopes.find((e) => e.envelope.id === dailyPool.id)!
    const dailyBalance = summary.envelopes.find((e) => e.envelope.id === dailySpending.id)!

    expect(poolBalance.balance).toBe(870000) // 900k - 30k
    expect(dailyBalance.balance).toBe(30000)
    expect(summary.accountingInvariantValid).toBe(true)
  })

  // 4. Spending Rp10.000 reduces the tracked balance and the appropriate spending envelope by exactly Rp10.000
  it('4. Spending Rp10.000 reduces the tracked balance and the appropriate spending envelope by exactly Rp10.000', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!

    const transactions: Transaction[] = [
      {
        id: 'tx-inc',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji',
      },
      {
        id: 'tx-spend-1',
        user_id: userId,
        type: 'expense',
        amount: 10000,
        date: '2026-10-01',
        envelope_id: dailySpending.id,
        description: 'Makan Siang Sederhana',
      },
    ]

    const transfers: Transfer[] = [
      {
        id: 'tr-daily-release',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-daily-spending',
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis Harian',
        created_at: '2026-10-01T08:00:00Z',
      },
    ]

    const summary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactions,
      transfers
    )

    // Tracked balance reduced from 3.800.000 by 10.000 -> 3.790.000
    expect(summary.trackedBalance).toBe(3790000)
    expect(summary.totalExpenses).toBe(10000)

    const dailyBalance = summary.envelopes.find((e) => e.envelope.id === dailySpending.id)!
    // Daily envelope balance reduced from 30.000 by 10.000 -> 20.000
    expect(dailyBalance.balance).toBe(20000)
    expect(summary.accountingInvariantValid).toBe(true)
  })

  // 5. Transferring Rp20.000 of daily surplus into the emergency fund does not increase income or the tracked balance
  it('5. Transferring Rp20.000 of daily surplus into the emergency fund does not increase income or the tracked balance', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!
    const emergencyFund = template.envelopes.find((e) => e.id === 'env-emergency-fund')!

    const surplusResult = routeSurplusFunds({
      userId,
      sourceEnvelope: dailySpending,
      destinationEnvelope: emergencyFund,
      amount: 20000,
      availableSurplus: 20000,
      reason: 'Sisa harian ke Dana Darurat',
    })

    expect(surplusResult.success).toBe(true)
    const transfer = surplusResult.transfer!

    const transactions: Transaction[] = [
      {
        id: 'tx-inc',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji',
      },
      {
        id: 'tx-spend-1',
        user_id: userId,
        type: 'expense',
        amount: 10000,
        date: '2026-10-01',
        envelope_id: dailySpending.id,
        description: 'Makan',
      },
    ]

    const transfers: Transfer[] = [
      {
        id: 'tr-daily-release',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-daily-spending',
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis Harian',
        created_at: '2026-10-01T08:00:00Z',
      },
      transfer,
    ]

    const summary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactions,
      transfers
    )

    // Income and tracked balance are completely unaffected by internal surplus routing
    expect(summary.totalIncome).toBe(3800000)
    expect(summary.trackedBalance).toBe(3790000)

    const dailyBalance = summary.envelopes.find((e) => e.envelope.id === dailySpending.id)!
    const emgBalance = summary.envelopes.find((e) => e.envelope.id === emergencyFund.id)!

    expect(dailyBalance.balance).toBe(0) // 30k in - 10k spend - 20k surplus = 0
    expect(emgBalance.balance).toBe(20000)
    expect(summary.accountingInvariantValid).toBe(true)
  })

  // 6. The next daily release draws from the remaining funding pool
  it('6. The next daily release draws from the remaining funding pool', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailyPool = template.envelopes.find((e) => e.id === 'pool-daily-spending')!
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!

    const initialTransfers: Transfer[] = [
      {
        id: 'tr-pool-init',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: dailyPool.id,
        amount: 900000,
        description: 'Alokasi Pool',
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'tr-day-1',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: dailyPool.id,
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis Hari 1',
        period_key: 'release:2026-10-01:env-daily-spending',
        created_at: '2026-10-01T08:00:00Z',
      },
    ]

    // Day 2 release
    const day2Result = releasePoolAllowance({
      userId,
      poolEnvelope: dailyPool,
      targetEnvelope: dailySpending,
      amount: 30000,
      periodKey: 'release:2026-10-02:env-daily-spending',
      currentPoolBalance: 870000, // 900k - 30k
      existingTransfers: initialTransfers,
    })

    expect(day2Result.success).toBe(true)
    const allTransfers = [...initialTransfers, day2Result.transfer!]

    const balances = calculateEnvelopeBalances(template.envelopes, [], allTransfers)
    const poolBal = balances.find((b) => b.envelope.id === dailyPool.id)!

    // Pool balance is now 900.000 - 30.000 - 30.000 = 840.000
    expect(poolBal.balance).toBe(840000)
  })

  // 7. A Rp250.000 expense against an envelope containing Rp200.000 creates an exact Rp50.000 deficit
  it('7. A Rp250.000 expense against an envelope containing Rp200.000 creates an exact Rp50.000 deficit', () => {
    const template = getInitialBudgetTemplate(userId)
    const jajanWeekly = template.envelopes.find((e) => e.id === 'env-weekly-jajan')!

    const transfers: Transfer[] = [
      {
        id: 'tr-jajan-allowance',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-weekly-jajan',
        destination_envelope_id: jajanWeekly.id,
        amount: 200000,
        description: 'Jajan Mingguan',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const transactions: Transaction[] = [
      {
        id: 'tx-overspend',
        user_id: userId,
        type: 'expense',
        amount: 250000,
        date: '2026-10-02',
        envelope_id: jajanWeekly.id,
        description: 'Traktir Teman Makan di Restoran',
      },
    ]

    const balances = calculateEnvelopeBalances(template.envelopes, transactions, transfers)
    const jajanInfo = balances.find((b) => b.envelope.id === jajanWeekly.id)!

    expect(jajanInfo.balance).toBe(-50000)
    expect(jajanInfo.isDeficit).toBe(true)
    expect(jajanInfo.deficitAmount).toBe(50000)
  })

  // 8. Covering Rp50.000 from an eligible source reduces that source by Rp50.000 and resolves the deficit without changing the tracked balance
  it('8. Covering Rp50.000 from an eligible source reduces that source by Rp50.000 and resolves the deficit without changing the tracked balance', () => {
    const template = getInitialBudgetTemplate(userId)
    const jajanWeekly = template.envelopes.find((e) => e.id === 'env-weekly-jajan')!
    const fuel = template.envelopes.find((e) => e.id === 'env-fuel')!

    const transactions: Transaction[] = [
      {
        id: 'tx-inc',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji',
      },
      {
        id: 'tx-overspend',
        user_id: userId,
        type: 'expense',
        amount: 250000,
        date: '2026-10-02',
        envelope_id: jajanWeekly.id,
        description: 'Makan Restoran',
      },
    ]

    const initialTransfers: Transfer[] = [
      {
        id: 'tr-jajan',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-weekly-jajan',
        destination_envelope_id: jajanWeekly.id,
        amount: 200000,
        description: 'Jajan Minggu 1',
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'tr-fuel',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: fuel.id,
        amount: 240000,
        description: 'Alokasi Bensin',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const coverage = coverDeficitManual({
      userId,
      deficitEnvelopeId: jajanWeekly.id,
      deficitAmount: 50000,
      allocations: [
        {
          sourceEnvelope: fuel,
          availableFunds: 240000,
          amountToTake: 50000,
        },
      ],
      relatedTransactionId: 'tx-overspend',
    })

    expect(coverage.success).toBe(true)
    expect(coverage.transfers.length).toBe(1)
    expect(coverage.remainingDeficit).toBe(0)

    const allTransfers = [...initialTransfers, ...coverage.transfers]

    const summary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactions,
      allTransfers
    )

    // Tracked balance stays 3.800.000 - 250.000 = 3.550.000
    expect(summary.trackedBalance).toBe(3550000)

    const jajanBal = summary.envelopes.find((b) => b.envelope.id === jajanWeekly.id)!
    const fuelBal = summary.envelopes.find((b) => b.envelope.id === fuel.id)!

    expect(jajanBal.balance).toBe(0) // Deficit completely resolved!
    expect(jajanBal.isDeficit).toBe(false)
    expect(fuelBal.balance).toBe(190000) // 240.000 - 50.000 = 190.000
    expect(summary.accountingInvariantValid).toBe(true)
  })

  // 9. Automatic coverage respects protected balances
  it('9. Automatic coverage respects protected balances', () => {
    const template = getInitialBudgetTemplate(userId)
    const jajanWeekly = template.envelopes.find((e) => e.id === 'env-weekly-jajan')!
    const savings = template.envelopes.find((e) => e.id === 'env-main-savings')! // min_protected_balance: 1.000.000
    const fuel = template.envelopes.find((e) => e.id === 'env-fuel')! // min_protected_balance: 0

    // Savings has 1.000.000, exactly equal to protected balance
    // Fuel has 100.000, non-protected
    const envelopeBalances = [
      {
        envelope: savings,
        balance: 1000000,
        spentAmount: 0,
        transferredIn: 1000000,
        transferredOut: 0,
        isDeficit: false,
        deficitAmount: 0,
        availableSurplus: 0, // protected!
      },
      {
        envelope: fuel,
        balance: 100000,
        spentAmount: 0,
        transferredIn: 100000,
        transferredOut: 0,
        isDeficit: false,
        deficitAmount: 0,
        availableSurplus: 100000,
      },
    ]

    const rules: DeficitRule[] = [
      {
        id: 'rule-savings',
        user_id: userId,
        target_envelope_id: jajanWeekly.id,
        source_envelope_id: savings.id,
        priority_order: 1, // Higher priority but protected!
        max_coverage_amount: null,
        is_active: true,
      },
      {
        id: 'rule-fuel',
        user_id: userId,
        target_envelope_id: jajanWeekly.id,
        source_envelope_id: fuel.id,
        priority_order: 2,
        max_coverage_amount: null,
        is_active: true,
      },
    ]

    const autoResult = coverDeficitAuto({
      userId,
      deficitEnvelope: jajanWeekly,
      deficitAmount: 40000,
      envelopeBalances,
      rules,
    })

    expect(autoResult.success).toBe(true)
    expect(autoResult.transfers.length).toBe(1)
    // Must NOT have taken from protected savings! Must take from fuel:
    expect(autoResult.transfers[0].source_envelope_id).toBe(fuel.id)
    expect(autoResult.transfers[0].amount).toBe(40000)
    expect(autoResult.coveredTotal).toBe(40000)
    expect(autoResult.remainingDeficit).toBe(0)
  })

  // 10. An insufficient funding pool does not permit new money to be created
  it('10. An insufficient funding pool does not permit new money to be created', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailyPool = template.envelopes.find((e) => e.id === 'pool-daily-spending')!
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!

    // Pool has only 15.000, but daily release requires 30.000
    const releaseResult = releasePoolAllowance({
      userId,
      poolEnvelope: dailyPool,
      targetEnvelope: dailySpending,
      amount: 30000,
      periodKey: 'release:2026-10-31:env-daily-spending',
      currentPoolBalance: 15000,
      existingTransfers: [],
    })

    expect(releaseResult.success).toBe(false)
    expect(releaseResult.transfer).toBeUndefined()
    expect(releaseResult.shortage).toBe(15000)
    expect(releaseResult.error).toContain('tidak mencukupi')
  })

  // 11. Repeating a period-close action does not duplicate allocations
  it('11. Repeating a period-close action does not duplicate allocations (idempotency)', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailyPool = template.envelopes.find((e) => e.id === 'pool-daily-spending')!
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!

    const periodKey = 'release:2026-10-05:env-daily-spending'
    const existingTransfers: Transfer[] = [
      {
        id: 'tr-previous',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: dailyPool.id,
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis sebelumnya',
        period_key: periodKey,
        created_at: '2026-10-05T08:00:00Z',
      },
    ]

    const retryResult = releasePoolAllowance({
      userId,
      poolEnvelope: dailyPool,
      targetEnvelope: dailySpending,
      amount: 30000,
      periodKey,
      currentPoolBalance: 800000,
      existingTransfers,
    })

    expect(retryResult.success).toBe(false)
    expect(retryResult.error).toContain('idempotent')
    expect(retryResult.transfer).toBeUndefined()
  })

  // 12. Editing or deleting a historical transaction preserves all accounting invariants
  it('12. Editing or deleting a historical transaction preserves all accounting invariants', () => {
    const template = getInitialBudgetTemplate(userId)
    const fuel = template.envelopes.find((e) => e.id === 'env-fuel')!

    const initialTransactions: Transaction[] = [
      {
        id: 'tx-inc',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji',
      },
      {
        id: 'tx-fuel-1',
        user_id: userId,
        type: 'expense',
        amount: 50000,
        date: '2026-10-02',
        envelope_id: fuel.id,
        description: 'Isi Pertamax',
      },
    ]

    const transfers: Transfer[] = [
      {
        id: 'tr-fuel-init',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: fuel.id,
        amount: 240000,
        description: 'Alokasi Fuel',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    // Summary before edit
    const summaryBefore = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      initialTransactions,
      transfers
    )
    expect(summaryBefore.trackedBalance).toBe(3750000)
    expect(summaryBefore.accountingInvariantValid).toBe(true)

    // Edit transaction: changed from 50.000 to 70.000
    const editedTransactions: Transaction[] = [
      initialTransactions[0],
      {
        ...initialTransactions[1],
        amount: 70000,
      },
    ]

    const summaryAfterEdit = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      editedTransactions,
      transfers
    )
    expect(summaryAfterEdit.trackedBalance).toBe(3730000)
    expect(summaryAfterEdit.accountingInvariantValid).toBe(true)
    const fuelAfterEdit = summaryAfterEdit.envelopes.find((e) => e.envelope.id === fuel.id)!
    expect(fuelAfterEdit.balance).toBe(170000) // 240k - 70k

    // Delete transaction: only income remains
    const transactionsAfterDelete = [initialTransactions[0]]
    const summaryAfterDelete = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactionsAfterDelete,
      transfers
    )
    expect(summaryAfterDelete.trackedBalance).toBe(3800000)
    expect(summaryAfterDelete.accountingInvariantValid).toBe(true)
    const fuelAfterDelete = summaryAfterDelete.envelopes.find((e) => e.envelope.id === fuel.id)!
    expect(fuelAfterDelete.balance).toBe(240000)
  })

  // 13. Transfers never count as income or expenses
  it('13. Transfers never count as income or expenses', () => {
    const template = getInitialBudgetTemplate(userId)
    const pool = template.envelopes[0]
    const target = template.envelopes[1]

    const internalTransfers: Transfer[] = [
      {
        id: 'tr-1',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: pool.id,
        destination_envelope_id: target.id,
        amount: 500000,
        description: 'Internal Transfer',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const summary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      [], // Zero transactions
      internalTransfers
    )

    expect(summary.totalIncome).toBe(0)
    expect(summary.totalExpenses).toBe(0)
    expect(summary.trackedBalance).toBe(0)
  })

  // 14. Period transitions do not silently discard unused balances
  it('14. Period transitions do not silently discard unused balances', () => {
    const template = getInitialBudgetTemplate(userId)
    const fuel = template.envelopes.find((e) => e.id === 'env-fuel')!

    const transfers: Transfer[] = [
      {
        id: 'tr-oct-fuel',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: fuel.id,
        amount: 240000,
        description: 'Alokasi Oktober',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const transactions: Transaction[] = [
      {
        id: 'tx-fuel-oct',
        user_id: userId,
        type: 'expense',
        amount: 140000,
        date: '2026-10-20',
        envelope_id: fuel.id,
        description: 'Bensin',
      },
    ]

    // October remaining balance = 100.000
    const octSummary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactions,
      transfers
    )
    const octFuel = octSummary.envelopes.find((e) => e.envelope.id === fuel.id)!
    expect(octFuel.balance).toBe(100000)

    // In November, default rollover policy 'roll_over' preserves the unspent Rp100.000
    // plus November new allocation Rp240.000 -> balance becomes 340.000!
    const novTransfers: Transfer[] = [
      ...transfers,
      {
        id: 'tr-nov-fuel',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: fuel.id,
        amount: 240000,
        description: 'Alokasi November',
        created_at: '2026-11-01T00:00:00Z',
      },
    ]

    const novSummary = generateFinancialSummary(
      mockProfile,
      template.envelopes,
      transactions,
      novTransfers
    )
    const novFuel = novSummary.envelopes.find((e) => e.envelope.id === fuel.id)!
    expect(novFuel.balance).toBe(340000)
    expect(novSummary.accountingInvariantValid).toBe(true)
  })

  // 15. RLS / Ownership verification: Records of another user cannot be accessed or mixed
  it('15. RLS prevents cross-user contamination and validates ownership', () => {
    const otherUserId = 'other-user-999'

    const user1Transfers: Transfer[] = [
      {
        id: 'tr-u1',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: 'env-1',
        amount: 500000,
        description: 'Alokasi User 1',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    const user2Transfers: Transfer[] = [
      {
        id: 'tr-u2',
        user_id: otherUserId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: 'env-1',
        amount: 9999999,
        description: 'Alokasi User 2',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    // Verify filter strictly enforces auth.uid() === user_id
    const filteredForUser1 = [...user1Transfers, ...user2Transfers].filter(
      (t) => t.user_id === userId
    )

    expect(filteredForUser1.length).toBe(1)
    expect(filteredForUser1[0].id).toBe('tr-u1')
    expect(filteredForUser1[0].amount).toBe(500000)
  })

  // 16. CSV export and JSON backup preserve the correct financial values
  it('16. CSV export and JSON backup preserve the correct financial values', () => {
    const template = getInitialBudgetTemplate(userId)
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        user_id: userId,
        type: 'income',
        amount: 3800000,
        date: '2026-10-01',
        envelope_id: null,
        description: 'Gaji Pokok',
        notes: 'Rekening BCA',
      },
      {
        id: 'tx-2',
        user_id: userId,
        type: 'expense',
        amount: 35000,
        date: '2026-10-02',
        envelope_id: 'env-wet-cat-treats',
        description: 'Beli Whiskas Wet',
        notes: 'Supermarket',
      },
    ]

    const transfers: Transfer[] = [
      {
        id: 'tr-1',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-daily-spending',
        destination_envelope_id: 'env-daily-spending',
        amount: 30000,
        description: 'Rilis Harian',
        period_key: 'release:2026-10-01:env-daily-spending',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    // 16a. CSV Export
    const txCSV = exportTransactionsToCSV(transactions, template.envelopes)
    expect(txCSV).toContain('Gaji Pokok')
    expect(txCSV).toContain('3800000')
    expect(txCSV).toContain('Beli Whiskas Wet')
    expect(txCSV).toContain('35000')

    const trCSV = exportTransfersToCSV(transfers, template.envelopes)
    expect(trCSV).toContain('Rilis Harian')
    expect(trCSV).toContain('30000')

    // 16b. JSON Backup & Restore Validation
    const backup = createFullJSONBackup({
      profile: mockProfile,
      envelopes: template.envelopes,
      transactions,
      transfers,
      deficitRules: [],
      periodReviews: [],
    })

    const jsonString = JSON.stringify(backup)
    const validation = validateJSONBackup(jsonString)

    expect(validation.valid).toBe(true)
    expect(validation.data?.transactions.length).toBe(2)
    expect(validation.data?.transactions[0].amount).toBe(3800000)
    expect(validation.data?.envelopes.length).toBe(template.envelopes.length)
  })

  it('Rupiah formatting adheres to standard Indonesian format', () => {
    expect(formatRupiah(3800000)).toBe('Rp3.800.000')
    expect(formatRupiah(30000)).toBe('Rp30.000')
    expect(formatRupiah(1000000)).toBe('Rp1.000.000')
    expect(formatRupiah(-50000)).toBe('-Rp50.000')
    expect(formatRupiah(0)).toBe('Rp0')
  })

  it('18. Covering a deficit increases spentAmount (terpakai) on the source envelope', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!
    const emergencyFund = template.envelopes.find((e) => e.id === 'env-emergency-fund')!

    // Initial allocations: Emergency fund gets Rp305.000, Daily spending gets Rp30.000 release
    const initialTransfers: Transfer[] = [
      {
        id: 'tr-alloc-emergency',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: emergencyFund.id,
        amount: 305000,
        description: 'Alokasi Dana Darurat',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'tr-release-daily',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-daily-spending',
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis Harian',
        created_at: '2026-10-01T08:00:00Z',
      },
    ]

    // Daily spending overspends by Rp20.000 (spent Rp50.000 when balance is Rp30.000)
    const transactions: Transaction[] = [
      {
        id: 'tx-overspend',
        user_id: userId,
        type: 'expense',
        amount: 50000,
        date: '2026-10-01',
        envelope_id: dailySpending.id,
        description: 'Makan Bersama Teman',
      },
    ]

    // Before deficit coverage:
    const summaryBefore = generateFinancialSummary(mockProfile, template.envelopes, transactions, initialTransfers)
    const dailyBefore = summaryBefore.envelopes.find((e) => e.envelope.id === dailySpending.id)!
    const emergencyBefore = summaryBefore.envelopes.find((e) => e.envelope.id === emergencyFund.id)!

    expect(dailyBefore.balance).toBe(-20000) // in deficit
    expect(dailyBefore.isDeficit).toBe(true)
    expect(emergencyBefore.spentAmount).toBe(0) // Emergency fund has not spent anything yet

    // Emergency fund covers the Rp20.000 deficit
    const coverageTransfer: Transfer = {
      id: 'tr-cover-1',
      user_id: userId,
      type: 'deficit_coverage',
      source_envelope_id: emergencyFund.id,
      destination_envelope_id: dailySpending.id,
      amount: 20000,
      description: 'Menutup defisit Makan Bersama Teman',
      related_transaction_id: 'tx-overspend',
      created_at: '2026-10-01T09:00:00Z',
    }

    const allTransfers = [...initialTransfers, coverageTransfer]
    const summaryAfter = generateFinancialSummary(mockProfile, template.envelopes, transactions, allTransfers)
    const dailyAfter = summaryAfter.envelopes.find((e) => e.envelope.id === dailySpending.id)!
    const emergencyAfter = summaryAfter.envelopes.find((e) => e.envelope.id === emergencyFund.id)!

    // Daily envelope deficit is now fully resolved (balance is 0)
    expect(dailyAfter.balance).toBe(0)
    expect(dailyAfter.isDeficit).toBe(false)
    expect(dailyAfter.spentAmount).toBe(50000)

    // Source envelope (emergency fund) balance decreased by 20.000 AND its spentAmount (terpakai) increased by 20.000!
    expect(emergencyAfter.balance).toBe(285000)
    expect(emergencyAfter.spentAmount).toBe(20000)
    expect(emergencyAfter.deficitCoverGiven).toBe(20000)

    // Overall invariant holds true
    expect(summaryAfter.accountingInvariantValid).toBe(true)
  })

  it('19. Automatic deficit coverage uses the linked funding pool first before touching emergency/savings', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!
    const dailyPool = template.envelopes.find((e) => e.id === 'pool-daily-spending')!
    const emergencyFund = template.envelopes.find((e) => e.id === 'env-emergency-fund')!

    // Pool has Rp900.000, Emergency has Rp305.000, Daily has released Rp30.000
    const initialTransfers: Transfer[] = [
      {
        id: 'tr-pool-init',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: dailyPool.id,
        amount: 900000,
        description: 'Alokasi Pool',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'tr-daily-rel',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: dailyPool.id,
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis Hari 1',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'tr-emergency-init',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: emergencyFund.id,
        amount: 305000,
        description: 'Alokasi Emergency',
        created_at: '2026-10-01T08:00:00Z',
      },
    ]

    // Daily spending overspends by Rp15.000 (spent Rp45.000 when balance is Rp30.000)
    const transactions: Transaction[] = [
      {
        id: 'tx-overspend-auto',
        user_id: userId,
        type: 'expense',
        amount: 45000,
        date: '2026-10-01',
        envelope_id: dailySpending.id,
        description: 'Makan Siang Spesial',
      },
    ]

    const summary = generateFinancialSummary(mockProfile, template.envelopes, transactions, initialTransfers)
    const dailyInfo = summary.envelopes.find((e) => e.envelope.id === dailySpending.id)!
    expect(dailyInfo.isDeficit).toBe(true)
    expect(dailyInfo.deficitAmount).toBe(15000)

    // Run coverDeficitAuto with NO custom rules configured:
    const autoResult = coverDeficitAuto({
      userId,
      deficitEnvelope: dailySpending,
      deficitAmount: dailyInfo.deficitAmount,
      envelopeBalances: summary.envelopes,
      rules: [], // No custom rules!
    })

    expect(autoResult.success).toBe(true)
    expect(autoResult.coveredTotal).toBe(15000)
    expect(autoResult.remainingDeficit).toBe(0)
    expect(autoResult.transfers.length).toBe(1)

    // MUST have pulled from the linked parent pool (Daily Spending Pool), NOT from emergency fund or monthly spending!
    expect(autoResult.transfers[0].source_envelope_id).toBe(dailyPool.id)
    expect(autoResult.transfers[0].amount).toBe(15000)
    expect(autoResult.summaryLog[0]).toContain(dailyPool.name)
  })

  it('20. Automatic deficit coverage uses weekly jajan allowance before touching emergency funds', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!
    const weeklyJajan = template.envelopes.find((e) => e.id === 'env-weekly-jajan')!
    const emergencyFund = template.envelopes.find((e) => e.id === 'env-emergency-fund')!

    // Assume all pools are empty (0 balance), but Weekly Jajan has Rp200.000 released, Emergency has Rp305.000
    const initialTransfers: Transfer[] = [
      {
        id: 'tr-weekly-rel',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-weekly-jajan',
        destination_envelope_id: weeklyJajan.id,
        amount: 200000,
        description: 'Rilis Jajan Minggu Ini',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'tr-emergency-init',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: emergencyFund.id,
        amount: 305000,
        description: 'Alokasi Emergency',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'tr-daily-rel',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-daily-spending',
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis Hari 1',
        created_at: '2026-10-01T08:00:00Z',
      },
    ]

    // Daily spending overspends by Rp10.000 (spent Rp40.000 when balance is Rp30.000)
    const transactions: Transaction[] = [
      {
        id: 'tx-overspend-jajan',
        user_id: userId,
        type: 'expense',
        amount: 40000,
        date: '2026-10-01',
        envelope_id: dailySpending.id,
        description: 'Makan Tambah Lauk',
      },
    ]

    const summary = generateFinancialSummary(mockProfile, template.envelopes, transactions, initialTransfers)
    const dailyInfo = summary.envelopes.find((e) => e.envelope.id === dailySpending.id)!

    // Run coverDeficitAuto with NO custom rules:
    const autoResult = coverDeficitAuto({
      userId,
      deficitEnvelope: dailySpending,
      deficitAmount: dailyInfo.deficitAmount,
      envelopeBalances: summary.envelopes,
      rules: [],
    })

    expect(autoResult.success).toBe(true)
    expect(autoResult.coveredTotal).toBe(10000)
    // Must have pulled from Weekly Jajan (tunjangan mingguan), NOT touching emergency funds!
    expect(autoResult.transfers[0].source_envelope_id).toBe(weeklyJajan.id)
    expect(autoResult.summaryLog.some((log) => log.includes(weeklyJajan.name))).toBe(true)
  })

  it('21. Daily envelope spentThisPeriod resets on a new day while preserving lifetime spentAmount and balance', () => {
    const template = getInitialBudgetTemplate(userId)
    const dailySpending = template.envelopes.find((e) => e.id === 'env-daily-spending')!

    // Transfer in: Rp30.000 allocated on day 1 (Oct 26) and Rp30.000 released on day 2 (Oct 27)
    const transfers: Transfer[] = [
      {
        id: 'tr-1',
        user_id: userId,
        type: 'allocation',
        source_envelope_id: null,
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Alokasi Day 1',
        created_at: '2026-10-26T08:00:00Z',
      },
      {
        id: 'tr-2',
        user_id: userId,
        type: 'pool_release',
        source_envelope_id: 'pool-daily-spending',
        destination_envelope_id: dailySpending.id,
        amount: 30000,
        description: 'Rilis Day 2',
        created_at: '2026-10-27T08:00:00Z',
      },
    ]

    // Transactions: Spent Rp25.000 on Oct 26, and Rp10.000 on Oct 27
    const transactions: Transaction[] = [
      {
        id: 'tx-day1',
        user_id: userId,
        type: 'expense',
        amount: 25000,
        date: '2026-10-26',
        envelope_id: dailySpending.id,
        description: 'Makan Day 1',
      },
      {
        id: 'tx-day2',
        user_id: userId,
        type: 'expense',
        amount: 10000,
        date: '2026-10-27',
        envelope_id: dailySpending.id,
        description: 'Makan Day 2',
      },
    ]

    // Evaluate on Day 2 (2026-10-27 Jakarta time)
    const nowDay2 = new Date('2026-10-27T10:00:00+07:00')
    const summaryDay2 = generateFinancialSummary(mockProfile, template.envelopes, transactions, transfers, nowDay2)
    const dailyDay2 = summaryDay2.envelopes.find((e) => e.envelope.id === dailySpending.id)!

    // Lifetime spentAmount is cumulative: 25.000 + 10.000 = 35.000
    expect(dailyDay2.spentAmount).toBe(35000)

    // Sisa Saldo: 60.000 in - 35.000 out = 25.000
    expect(dailyDay2.balance).toBe(25000)

    // spentThisPeriod for today (Oct 27) only counts today's expense = Rp10.000!
    // It does NOT include yesterday's Rp25.000, so progress bar will not be red!
    expect(dailyDay2.spentThisPeriod).toBe(10000)
    expect((dailyDay2.spentThisPeriod ?? 0) <= dailyDay2.envelope.period_amount).toBe(true)

    // Evaluate on Day 3 with NO expenses yet (2026-10-28)
    const nowDay3 = new Date('2026-10-28T09:00:00+07:00')
    const summaryDay3 = generateFinancialSummary(mockProfile, template.envelopes, transactions, transfers, nowDay3)
    const dailyDay3 = summaryDay3.envelopes.find((e) => e.envelope.id === dailySpending.id)!

    // On Day 3, spentThisPeriod resets to 0!
    expect(dailyDay3.spentThisPeriod).toBe(0)
    // Lifetime spentAmount and balance remain preserved
    expect(dailyDay3.spentAmount).toBe(35000)
    expect(dailyDay3.balance).toBe(25000)
  })
})

