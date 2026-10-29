import { useCallback } from 'react';

// Each form explicitly supplies its own state setter. This avoids ambiguous fields
// such as "nome" and "email" changing the wrong form when more than one is rendered.
export default function useFormFields() {
  const createChangeHandler = useCallback((setValues, parsers = {}) => (event) => {
    const { name, value, type, checked } = event.target;
    const rawValue = type === 'checkbox' ? checked : value;
    const nextValue = parsers[name] ? parsers[name](rawValue, event) : rawValue;

    setValues((current) => ({ ...current, [name]: nextValue }));
  }, []);

  return { createChangeHandler };
}
