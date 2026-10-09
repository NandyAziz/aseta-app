export interface Transaction {
  id: string;
  merchantName: string;
  originalAmount: number;
  roundedAmount: number;
  savingsAmount: number;
  timestamp: string;
  date: string;
}

export interface SavingsState {
  balance: number;
  dailyCap: number;
  todaySavings: number;
  history: Transaction[];
  // Saldo dompet utama (simulasi bank/e-wallet) untuk pembayaran QRIS
  walletBalance: number;
}
