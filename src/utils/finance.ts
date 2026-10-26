export type Transaction = {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number; // integer IDR, > 0
  date: string; // YYYY-MM-DD
  envelope_id: string | null;
  description: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Calculate the net balance from a list of transactions.
 * Income amounts are added, expense amounts are subtracted.
 */
export function calculateBalance(transactions: Transaction[]): number {
  return transactions.reduce((acc, tx) => {
    return tx.type === 'income' ? acc + tx.amount : acc - tx.amount;
  }, 0);
}
