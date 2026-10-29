import { useState } from 'react';
import { validateProfileForm } from '../utils/formValidation';

const initialCustomerEditForm = { nome: '', email: '', endereco: '' };

function parseResponse(response) {
  return response.json().then((data) => {
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Nao foi possivel concluir a acao.');
    return data;
  });
}

export default function useAdminCustomers({ setStatus, setLoading } = {}) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [customerEditForm, setCustomerEditForm] = useState(initialCustomerEditForm);

  async function fetchCustomers(search = customerSearch) {
    try {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/admin/customers${params.toString() ? `?${params.toString()}` : ''}`);
      const data = await parseResponse(response);
      setCustomers(data.items || []);
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function fetchCustomerDetails(id) {
    try {
      const response = await fetch(`/api/admin/customers/${id}`);
      const data = await parseResponse(response);
      setSelectedCustomer(data.customer);
      setCustomerDetail(data);
      setCustomerEditForm({
        nome: data.customer.nome || '',
        email: data.customer.email || '',
        endereco: data.customer.endereco || '',
      });
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function submitCustomerEdit(event) {
    event.preventDefault();

    if (!selectedCustomer) {
      return;
    }

    const validationError = validateProfileForm(customerEditForm);
    if (validationError) {
      setStatus?.(validationError);
      return;
    }

    setLoading?.(true);
    setStatus?.('Atualizando cliente...');

    try {
      const response = await fetch(`/api/admin/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerEditForm),
      });
      await parseResponse(response);
      await fetchCustomerDetails(selectedCustomer.id);
      await fetchCustomers();
      setStatus?.('Cliente atualizado com sucesso.');
    } catch (error) {
      setStatus?.(error.message);
    } finally {
      setLoading?.(false);
    }
  }

  return {
    customerSearch,
    setCustomerSearch,
    customers,
    setCustomers,
    selectedCustomer,
    setSelectedCustomer,
    customerDetail,
    setCustomerDetail,
    customerEditForm,
    setCustomerEditForm,
    fetchCustomers,
    fetchCustomerDetails,
    submitCustomerEdit,
  };
}
