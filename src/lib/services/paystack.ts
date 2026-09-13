import { usePaystackPayment } from 'react-paystack';
import { nexus } from '../nexus';

export interface CheckoutConfig {
  email: string;
  amount: number; // in NGN (will be multiplied by 100 in the hook)
  metadata?: any;
  subaccount?: string; // Optional: for split payments
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

/**
 * The Paystack public key for this build.
 *
 * There is deliberately no fallback. A hard-coded test key meant a production
 * build missing its variable silently took payments in test mode — the
 * customer saw a success, and no money moved.
 */
export const getPaystackPublicKey = (): string => {
  const key = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  if (!key) {
    throw new Error('Payments are not configured: VITE_PAYSTACK_PUBLIC_KEY is missing from this build.');
  }
  return key;
};

export const useCheckout = (config: CheckoutConfig) => {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

  const initializePayment = usePaystackPayment({
    reference: (new Date()).getTime().toString(),
    email: config.email,
    amount: config.amount * 100, // Paystack expects kobo
    publicKey: publicKey || '',
    metadata: config.metadata,
    subaccount: config.subaccount, // Required for split payments
    currency: 'NGN',
  });

  const pay = () => {
    if (!publicKey) {
      console.error('[Paystack] VITE_PAYSTACK_PUBLIC_KEY is missing from this build.');
      alert('Payments are temporarily unavailable. Please try again later.');
      config.onClose?.();
      return;
    }
    try {
      (initializePayment as any)({
        onSuccess: (reference: any) => {
          config.onSuccess(reference?.reference || reference?.trxref || reference);
        },
        onClose: () => {
          if (config.onClose) config.onClose();
        }
      });
    } catch {
      (initializePayment as any)(
        (reference: any) => config.onSuccess(reference?.reference || reference?.trxref || reference),
        () => config.onClose && config.onClose()
      );
    }
  };

  return { pay };
};

export const paystackService = {
  createSubaccount: async (bank_code: string, account_number: string, business_name: string) => {
    // We call the InsForge edge function
    const { data, error } = await nexus.functions.invoke('paystack-subaccount', {
      body: { bank_code, account_number, business_name, percentage_charge: 10 }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.data; // { subaccount_code, bank_details }
  }
};
