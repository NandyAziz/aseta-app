export interface Transaction {
  id: string;
  merchantName: string;
  originalAmount: number;
  roundedAmount: number;
  savingsAmount: number;
  timestamp: string;
  date: string;
}

// Daily quest progress. Auto-resets when the date changes.
export interface QuestState {
  date: string; // YYYY-MM-DD of when the quest was last reset
  qrisDone: boolean; // already did 1 QRIS round-up today
  qrisClaimed: boolean;
  depositClaimed: boolean; // depositDone is derived from todaySavings >= 5000
  greetCount: number; // number of mascot taps today
  greetClaimed: boolean;
}

export interface SavingsState {
  balance: number;
  dailyCap: number;
  todaySavings: number;
  history: Transaction[];
  // Main wallet balance (simulated bank/e-wallet) used for QRIS payments
  walletBalance: number;
  // Gamification: daily streak & last activity date
  streak: number;
  lastActiveDate: string;
  // Daily quests
  quests: QuestState;
  // Snapshot of portfolio values (max 7 latest entries) for the growth chart
  growth: number[];
}
