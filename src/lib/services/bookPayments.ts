/**
 * Buying and borrowing books.
 *
 * The flow is initialize → pay → verify, and the browser is trusted with none
 * of it beyond opening the popup:
 *
 *   initialize  the backend reads the book's price from the database, issues
 *               an unguessable reference and records a pending payment
 *   pay         Paystack collects the card details
 *   verify      the backend asks Paystack what actually happened, compares the
 *               amount against what it opened the charge for, and only then
 *               grants access
 *
 * What this replaces granted the whole cart the moment Paystack's popup fired
 * onSuccess in the browser. Nothing checked the reference, so calling that
 * callback from the console was enough to take everything for free.
 *
 * Verification is also not the only path: the Paystack webhook settles the
 * same reference server-side, so a customer who closes the tab mid-payment
 * still gets their book. Whichever arrives first wins; the other finds the
 * work done and returns success.
 */

import { nexus, errorMessage } from '../nexus';

export type BookPurchaseType = 'purchase' | 'borrow';

export interface InitializedPayment {
  reference: string;
  amount_minor: number;
  currency: string;
  authorization_url?: string;
  access_code?: string;
}

/**
 * Opens a charge for a book and returns what the popup needs.
 *
 * The amount is not a parameter. It is computed server-side from the book's
 * price, so a modified page cannot buy a ₦20,000 book for ₦1.
 */
export const initializeBookPayment = async (
  bookId: string,
  type: BookPurchaseType,
  /**
   * Who the licence is for. Omitted means the buyer themselves; supplied means
   * a mentor sponsoring a mentee. The backend refuses a beneficiary who is not
   * actually the caller's mentee, so this cannot be used to issue licences to
   * arbitrary accounts.
   */
  beneficiaryId?: string,
  /** The request this fulfils, so it can be closed once paid. */
  requestId?: string
): Promise<InitializedPayment> => {
  const { data, error } = await nexus.functions.invoke('payments-initialize', {
    body: { bookId, type, beneficiaryId, requestId }
  });

  if (error) throw new Error(errorMessage(error, 'Could not start this payment.'));
  if (data?.error) throw new Error(data.error);
  if (!data?.reference) throw new Error('The payment could not be started.');

  return data as InitializedPayment;
};

export interface VerifiedPayment {
  book_id?: string;
  type?: string;
  access_type?: string;
  expires_at?: string | null;
  already_processed?: boolean;
}

/**
 * Confirms a payment and grants the book.
 *
 * Safe to call more than once for the same reference — the webhook may already
 * have settled it, which is success, not an error.
 */
export const verifyBookPayment = async (reference: string): Promise<VerifiedPayment> => {
  const { data, error } = await nexus.functions.invoke('payments-verify', {
    body: { reference }
  });

  if (error) throw new Error(errorMessage(error, 'Could not verify this payment.'));
  if (data?.error) throw new Error(data.error);

  return data as VerifiedPayment;
};

/**
 * Loads Paystack's inline script once and resolves with the global it defines.
 *
 * Loaded on demand rather than in index.html so a reader who never buys
 * anything does not pay for the script, and so a blocked third-party request
 * surfaces as a clear failure at the moment of purchase instead of a silently
 * missing global.
 */
const loadPaystackInline = (): Promise<any> =>
  new Promise((resolve, reject) => {
    const existing = (window as any).PaystackPop;
    if (existing) return resolve(existing);

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      const pop = (window as any).PaystackPop;
      pop ? resolve(pop) : reject(new Error('Paystack loaded but did not initialise.'));
    };
    script.onerror = () =>
      reject(new Error('Could not reach the payment provider. Check your connection.'));
    document.head.appendChild(script);
  });

export interface PayForBookResult {
  status: 'completed' | 'cancelled';
  access?: VerifiedPayment;
}

/**
 * The whole flow, start to finish.
 *
 * Resolves 'cancelled' when the customer closes the popup — that is an
 * ordinary outcome, not an error, and should not be reported as a failure.
 */
export const payForBook = async (
  bookId: string,
  type: BookPurchaseType,
  email: string,
  /** A mentee's id, when a mentor is paying on their behalf. */
  beneficiaryId?: string,
  requestId?: string
): Promise<PayForBookResult> => {
  const init = await initializeBookPayment(bookId, type, beneficiaryId, requestId);

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  if (!publicKey) {
    throw new Error('Payments are not configured in this build.');
  }

  const PaystackPop = await loadPaystackInline();

  const reference = await new Promise<string | null>((resolve, reject) => {
    try {
      const handler = PaystackPop.setup({
        key: publicKey,
        email,
        // Both from the backend. Sending our own amount here would let the
        // popup charge something other than what was authorised.
        amount: init.amount_minor,
        currency: init.currency || 'NGN',
        ref: init.reference,
        callback: (response: any) => resolve(response?.reference || init.reference),
        onClose: () => resolve(null)
      });
      handler.openIframe();
    } catch (err) {
      reject(err);
    }
  });

  if (!reference) return { status: 'cancelled' };

  const access = await verifyBookPayment(reference);
  return { status: 'completed', access };
};
