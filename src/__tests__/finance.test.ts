// src/__tests__/finance.test.ts
import { describe, it, expect } from 'vitest';
import { calculateBalance, type Transaction } from '../utils/finance';

describe('calculateBalance', () => {
  it('calculates net balance correctly', () => {
    const transactions: Transaction[] = [
      { id: '1', user_id: 'u1', type: 'income', amount: 1000, date: '2024-01-01', envelope_id: null, description: 'Salary' },
      { id: '2', user_id: 'u1', type: 'expense', amount: 200, date: '2024-01-02', envelope_id: null, description: 'Groceries' },
      { id: '3', user_id: 'u1', type: 'income', amount: 500, date: '2024-01-03', envelope_id: null, description: 'Freelance' },
    ];
    const result = calculateBalance(transactions);
    expect(result).toBe(1300); // 1000 - 200 + 500
  });
});
