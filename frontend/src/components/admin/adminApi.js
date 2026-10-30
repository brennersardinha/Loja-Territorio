// Lê a resposta das rotas do admin e transforma erro HTTP em exceção com a mensagem do servidor.
export async function parseAdminResponse(response, fallbackMessage) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || fallbackMessage);
  return data;
}
