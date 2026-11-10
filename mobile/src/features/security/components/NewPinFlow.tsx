import { useState, type ReactNode } from 'react';
import { newPinProblem, type NewPinProblem } from '../domain/pinRules';
import { PinPad } from './PinPad';

const PROBLEM_MESSAGES: Record<NewPinProblem, string> = {
  length: 'El PIN debe tener 6 dígitos.',
  trivial: 'Ese PIN es muy fácil de adivinar. Elige otro.',
  mismatch: 'Los PIN no coinciden. Escríbelo de nuevo.',
};

type NewPinFlowProps = {
  title: string;
  /** Receives a valid, confirmed PIN. */
  onPin: (pin: string) => void;
  disabled?: boolean;
  error?: string | null;
  children?: ReactNode;
};

/** Choose a PIN, then type it again. Trivial PINs (111111, 123456) are refused. */
export function NewPinFlow({
  title,
  onPin,
  disabled,
  error,
  children,
}: NewPinFlowProps) {
  const [first, setFirst] = useState<string | null>(null);
  const [problem, setProblem] = useState<NewPinProblem | null>(null);

  if (first === null) {
    return (
      <PinPad
        testID="new-pin"
        title={title}
        message="Elige 6 dígitos que solo tú conozcas."
        error={problem ? PROBLEM_MESSAGES[problem] : error}
        disabled={disabled}
        onComplete={pin => {
          if (newPinProblem(pin, pin) === 'trivial') {
            setProblem('trivial');
            return;
          }
          setProblem(null);
          setFirst(pin);
        }}
      >
        {children}
      </PinPad>
    );
  }

  return (
    <PinPad
      testID="confirm-pin"
      title="Confirma tu PIN"
      message="Escríbelo otra vez."
      error={error}
      disabled={disabled}
      onComplete={pin => {
        const found = newPinProblem(first, pin);
        setFirst(null);
        if (found) {
          setProblem(found);
          return;
        }
        onPin(pin);
      }}
    >
      {children}
    </PinPad>
  );
}
