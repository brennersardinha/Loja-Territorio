// Carrega o Stripe.js oficial sob demanda (exigencia PCI: nao pode ser empacotado no bundle).
const STRIPE_JS_URL = 'https://js.stripe.com/v3/';
let scriptPromise = null;

function loadScript() {
  if (window.Stripe) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = STRIPE_JS_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { scriptPromise = null; reject(new Error('Não foi possível carregar o pagamento seguro. Verifique sua conexão.')); };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export async function loadStripe(publishableKey) {
  await loadScript();
  if (!window.Stripe) throw new Error('Pagamento seguro indisponível.');
  return window.Stripe(publishableKey);
}
