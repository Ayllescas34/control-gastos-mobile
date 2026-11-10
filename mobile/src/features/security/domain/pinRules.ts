export const PIN_LENGTH = 6;

export type NewPinProblem = 'length' | 'trivial' | 'mismatch';

/** Exactly six digits. */
export function isPinShaped(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/**
 * PINs anyone would try first: one repeated digit (111111) or a straight run (123456,
 * 987654). Refused when creating a PIN.
 */
export function isTrivialPin(pin: string): boolean {
  if (!isPinShaped(pin)) {
    return false;
  }
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, index) => digit - digits[index]);
  return steps.every(step => step === steps[0] && Math.abs(step) <= 1);
}

/** Why a new PIN and its confirmation cannot be used, or null when they can. */
export function newPinProblem(
  pin: string,
  confirmation: string,
): NewPinProblem | null {
  if (!isPinShaped(pin)) {
    return 'length';
  }
  if (isTrivialPin(pin)) {
    return 'trivial';
  }
  return pin === confirmation ? null : 'mismatch';
}

/** "30 s", "2 min": the wait before the next attempt. */
export function formatWait(milliseconds: number): string {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`;
}
