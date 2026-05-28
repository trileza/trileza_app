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

export const useCheckout = (config: CheckoutConfig) => {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const initializePayment = usePaystackPayment({
    reference: (new Date()).getTime().toString(),
    email: config.email,
    amount: config.amount * 100, // Paystack expects kobo
    publicKey: publicKey || 'pk_test_placeholder', // Fallback for testing if missing
    metadata: config.metadata,
    subaccount: config.subaccount, // Required for split payments
    currency: 'NGN',
  });

  const pay = () => {
    initializePayment({
      onSuccess: (reference: any) => {
        config.onSuccess(reference.reference);
      },
      onClose: config.onClose,
    });
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
