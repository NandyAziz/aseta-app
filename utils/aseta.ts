export type MascotExpression = 'idle' | 'tap' | 'celebrate';

export function calculateRoundUp(amount: number): number {
  if (amount <= 0) return 0;
  const remainder = amount % 5000;
  return remainder === 0 ? 0 : 5000 - remainder;
}

export function getMascotLevel(balance: number): { level: number; name: string; gif: string } {
  if (balance < 5000) {
    return { level: 1, name: 'Telur Aseta', gif: '/mascot-egg.gif' };
  }
  if (balance < 15000) {
    return { level: 2, name: 'Aseta Muda', gif: '/mascot-baby.gif' };
  }
  return { level: 3, name: 'Aseta Mandiri', gif: '/mascot-adult.gif' };
}
