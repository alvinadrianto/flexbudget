export type EnvelopeType =
  | 'spending_daily'
  | 'spending_weekly'
  | 'spending_monthly'
  | 'spending_custom'
  | 'savings'
  | 'emergency_fund'
  | 'funding_pool'
  | 'reserve'

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom'

export type RolloverPolicy =
  | 'roll_over'
  | 'reserve_savings'
  | 'reserve_emergency'
  | 'return_to_pool'
  | 'manual_review'

export type DeficitCoverageMode = 'manual' | 'auto'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  opening_balance: number // Integer IDR
  currency: string
  timezone: string
  created_at?: string
  updated_at?: string
}

export interface Envelope {
  id: string
  user_id: string
  name: string
  type: EnvelopeType
  period_type: PeriodType
  period_amount: number // Integer IDR
  funding_source_id: string | null // e.g. Daily Pool -> Daily Spending
  rollover_policy: RolloverPolicy
  surplus_destination_id: string | null
  deficit_coverage_mode: DeficitCoverageMode
  deficit_priority: number
  min_protected_balance: number // Integer IDR
  is_archived: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface EnvelopeBalanceInfo {
  envelope: Envelope
  balance: number // Can be negative when overspent
  spentAmount: number // Total expenses assigned to this envelope
  transferredIn: number // Total credits into this envelope
  transferredOut: number // Total debits out of this envelope
  isDeficit: boolean
  deficitAmount: number // >= 0
  availableSurplus: number // max(0, balance - min_protected_balance)
}

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number // Integer IDR, strictly > 0
  date: string // YYYY-MM-DD
  envelope_id: string | null // Required for expense, optional/null for income
  description: string
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type TransferType =
  | 'allocation'
  | 'pool_release'
  | 'deficit_coverage'
  | 'surplus_routing'
  | 'manual_transfer'
  | 'reversal'

export interface Transfer {
  id: string
  user_id: string
  type: TransferType
  source_envelope_id: string | null // null when allocated from unallocated cash
  destination_envelope_id: string | null // null when returning to unallocated cash
  amount: number // Integer IDR, strictly > 0
  description: string
  related_transaction_id?: string | null
  period_key?: string | null // Idempotency key (e.g. 'release:2026-10-26:envelopeId')
  created_at: string
}

export interface DeficitRule {
  id: string
  user_id: string
  target_envelope_id: string
  source_envelope_id: string
  priority_order: number
  max_coverage_amount: number | null
  is_active: boolean
  created_at?: string
}

export interface PeriodReview {
  id: string
  user_id: string
  envelope_id: string
  period_type: PeriodType
  period_key: string // e.g. '2026-10-26' or '2026-W43' or '2026-10'
  spent_amount: number
  surplus_amount: number
  deficit_amount: number
  action_taken: string
  notes?: string | null
  reviewed_at: string
}

export interface FinancialSummary {
  trackedBalance: number // opening_balance + totalIncome - totalExpenses
  totalIncome: number
  totalExpenses: number
  totalAllocated: number // sum of all positive envelope balances
  unallocatedCash: number // trackedBalance - total allocated
  todayIncome: number
  todayExpense: number
  weekIncome: number
  weekExpense: number
  monthIncome: number
  monthExpense: number
  savingsTotal: number
  emergencyTotal: number
  deficitCount: number
  totalDeficitAmount: number
  envelopes: EnvelopeBalanceInfo[]
  accountingInvariantValid: boolean
}

export interface FlexBudgetBackup {
  version: '1.0'
  exported_at: string
  profile: Profile
  envelopes: Envelope[]
  transactions: Transaction[]
  transfers: Transfer[]
  deficit_rules: DeficitRule[]
  period_reviews: PeriodReview[]
}
