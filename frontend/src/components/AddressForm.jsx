import { useEffect, useState } from 'react';
import Button from './ui/Button';
import Field from './ui/Field';
import { formatZipCode, lookupZipCode } from '../utils/zipCode';

// Endereço estruturado: o CEP vem primeiro e preenche rua, bairro, cidade e estado.
export default function AddressForm({ addressForm, setAddressForm, onSubmit, onCancel, loading, defaultRecipient, submitLabel = 'Usar este endereço' }) {
  const [lookingUp, setLookingUp] = useState(false);
  const [zipNotFound, setZipNotFound] = useState(false);
  const set = (name, value) => setAddressForm((current) => ({ ...current, [name]: value }));
  useEffect(() => { if (!addressForm.recipient_name && defaultRecipient) set('recipient_name', defaultRecipient); }, [defaultRecipient]);

  async function changeZip(event) {
    const zip = formatZipCode(event.target.value);
    set('zip_code', zip);
    setZipNotFound(false);
    if (zip.length !== 9) return;
    setLookingUp(true);
    const found = await lookupZipCode(zip);
    setLookingUp(false);
    if (!found) { setZipNotFound(true); return; }
    setAddressForm((current) => ({ ...current, street: found.street || current.street, neighborhood: found.neighborhood || current.neighborhood, city: found.city, state: found.state }));
    document.getElementById('address-number')?.focus();
  }

  return <form className="form-grid two-columns address-form" onSubmit={onSubmit}>
    <Field label="CEP" name="zip_code" value={addressForm.zip_code} onChange={changeZip} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" required hint={lookingUp ? 'Buscando endereço…' : undefined} error={zipNotFound ? 'CEP não encontrado. Preencha o endereço manualmente.' : undefined} />
    <Field label="Rua" name="street" value={addressForm.street} onChange={(event) => set('street', event.target.value)} autoComplete="address-line1" required className="full-span" />
    <Field id="address-number" label="Número" name="number" value={addressForm.number} onChange={(event) => set('number', event.target.value)} inputMode="numeric" required />
    <Field label="Complemento" name="complement" value={addressForm.complement} onChange={(event) => set('complement', event.target.value)} autoComplete="address-line2" placeholder="Opcional" />
    <Field label="Bairro" name="neighborhood" value={addressForm.neighborhood} onChange={(event) => set('neighborhood', event.target.value)} />
    <Field label="Cidade" name="city" value={addressForm.city} onChange={(event) => set('city', event.target.value)} autoComplete="address-level2" required />
    <Field label="Estado (UF)" name="state" value={addressForm.state} onChange={(event) => set('state', event.target.value.toUpperCase().slice(0, 2))} autoComplete="address-level1" maxLength="2" required />
    <Field label="Quem vai receber" name="recipient_name" value={addressForm.recipient_name} onChange={(event) => set('recipient_name', event.target.value)} autoComplete="name" required />
    <div className="button-row full-span"><Button type="submit" loading={loading}>{submitLabel}</Button>{onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}</div>
  </form>;
}
