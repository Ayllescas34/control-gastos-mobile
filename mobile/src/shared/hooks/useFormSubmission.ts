import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs a form's save at most once at a time. The ref blocks a second tap that arrives
 * before React re-renders the disabled button; `submitting` drives the UI. A failed save
 * is logged and its message kept for the form instead of being swallowed.
 *
 * `describeError` turns a failure into user-facing text (each feature knows its errors).
 */
export function useFormSubmission(describeError: (error: unknown) => string) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(
    async (
      save: () => Promise<void>,
      onError?: (error: unknown) => boolean,
    ) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setSubmitting(true);
      setSubmitError(null);
      try {
        await save();
      } catch (error) {
        // onError may map the error onto a field; otherwise it is shown for the whole form.
        if (!onError?.(error)) {
          console.error('Save failed', error);
          if (mounted.current) {
            setSubmitError(describeError(error));
          }
        }
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setSubmitting(false);
        }
      }
    },
    [describeError],
  );

  return { submitting, submitError, submit };
}
