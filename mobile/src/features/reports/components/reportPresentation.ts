/** "Sin movimientos", "1 movimiento", "3 movimientos". */
export function formatMovementCount(count: number): string {
  if (count === 0) {
    return 'Sin movimientos';
  }
  return `${count} ${count === 1 ? 'movimiento' : 'movimientos'}`;
}
