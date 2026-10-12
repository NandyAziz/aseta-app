export interface Transaction {
  id: string;
  merchantName: string;
  originalAmount: number;
  roundedAmount: number;
  savingsAmount: number;
  timestamp: string;
  date: string;
}

// Progres misi harian (daily quests). Reset otomatis saat tanggal berganti.
export interface QuestState {
  date: string; // YYYY-MM-DD kapan quest terakhir di-reset
  qrisDone: boolean; // sudah melakukan 1x pembulatan QRIS hari ini
  qrisClaimed: boolean;
  depositClaimed: boolean; // depositDone diturunkan dari todaySavings >= 5000
  greetCount: number; // jumlah tap maskot hari ini
  greetClaimed: boolean;
}

export interface SavingsState {
  balance: number;
  dailyCap: number;
  todaySavings: number;
  history: Transaction[];
  // Saldo dompet utama (simulasi bank/e-wallet) untuk pembayaran QRIS
  walletBalance: number;
  // Gamifikasi: streak harian & tanggal aktivitas terakhir
  streak: number;
  lastActiveDate: string;
  // Misi harian
  quests: QuestState;
  // Snapshot nilai portofolio (maks 7 entri terakhir) untuk grafik pertumbuhan
  growth: number[];
}
