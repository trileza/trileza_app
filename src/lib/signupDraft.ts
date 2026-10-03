/**
 * What someone typed into the sign-up form, kept across a round trip.
 *
 * Registration spans two screens — the sign-up form, then mentee onboarding —
 * and leaving the second one returns to the first. Without this, that trip
 * emptied every field and the person had to retype their name, handle, phone
 * and photo to get back to where they were.
 *
 * Never the password. Keeping one in storage means leaving it readable to any
 * script on the origin and to anyone who opens the device afterwards, which is
 * not a trade worth making to save one field of typing.
 *
 * sessionStorage rather than localStorage: the draft belongs to this attempt
 * at signing up, not to the browser forever. Closing the tab ends it.
 */

const KEY = 'trileza-signup-draft';

export interface SignupDraft {
  email?: string;
  username?: string;
  surname?: string;
  firstName?: string;
  middleName?: string;
  phoneNumber?: string;
  /** A data URL, which is what the picker produces. */
  avatarFile?: string | null;
}

export const signupDraft = {
  save(draft: SignupDraft): void {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Private mode, blocked storage, or a quota hit — an avatar data URL is
      // the largest thing here and the most likely cause. Losing the draft is
      // a worse form, not a broken one, so this stays silent.
    }
  },

  load(): SignupDraft | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Anything could be under this key; only use it if it looks like ours.
      return parsed && typeof parsed === 'object' ? (parsed as SignupDraft) : null;
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* Nothing to do if storage refuses. */
    }
  }
};

export default signupDraft;
