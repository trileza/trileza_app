/**
 * Where book files live, and how they are read back.
 *
 * Manuscripts go in a PRIVATE bucket. They used to sit in the same public
 * bucket as course materials, which meant anybody holding a file_url could
 * download the whole book without buying or borrowing it — the paywall existed
 * only in the UI. Verified against the live project: a request to the private
 * bucket with no token returns 401, and one bearing the public anon key
 * returns 403.
 *
 * Covers and sample pages deliberately stay public, in the old bucket. They are
 * marketing: they appear to signed-out visitors browsing the catalogue, and
 * putting them behind auth would break the storefront for exactly the people it
 * is meant to attract.
 *
 * Entitlement is enforced in the database, not here — see user_can_read_book()
 * and the storage_objects_book_files_read policy. This module only makes sure
 * every call site agrees on which bucket is which.
 */

import { nexus } from './nexus';

/** Manuscripts. Private: reads require an entitlement. */
export const BOOK_FILES_BUCKET = 'book-files';

/** Covers, samples, course materials. Public by design. */
export const PUBLIC_ASSETS_BUCKET = 'course-materials-trileza-784bc328';

/**
 * Uploads a manuscript and returns its object key.
 *
 * The key is stored rather than a URL: a private object has no durable public
 * URL, only short-lived signed ones minted per request. Callers that need
 * something to render should use `getReadableBookUrl`.
 */
export const uploadBookFile = async (
  userId: string,
  file: File
): Promise<{ key: string; fileName: string }> => {
  // Guard against a filename escaping the prefix it was given.
  const safeName = file.name.replace(/\.\./g, '_').replace(/^\/+/, '').replace(/[/\\]/g, '_');
  const key = `original/${userId}_${Date.now()}_${safeName}`;

  const { error } = await nexus.storage.from(BOOK_FILES_BUCKET).upload(key, file);
  if (error) throw error;

  return { key, fileName: file.name };
};

/** Uploads a cover or sample page, which stay publicly readable. */
export const uploadPublicBookAsset = async (
  kind: 'covers' | 'samples',
  userId: string,
  file: File
): Promise<string> => {
  const safeName = file.name.replace(/\.\./g, '_').replace(/^\/+/, '').replace(/[/\\]/g, '_');
  const key = `${kind}/${userId}_${Date.now()}_${safeName}`;

  const { error } = await nexus.storage.from(PUBLIC_ASSETS_BUCKET).upload(key, file);
  if (error) throw error;

  return nexus.storage.from(PUBLIC_ASSETS_BUCKET).getPublicUrl(key);
};

/**
 * A URL the reader can load for this book, or null if the caller is not
 * entitled to it.
 *
 * The URL is short-lived and minted per request, so it cannot be shared or
 * bookmarked into a permanent download link. A refused read is not an error
 * worth throwing — an expired borrow is an ordinary outcome — so this returns
 * null and lets the caller show the right thing.
 */
export const getReadableBookUrl = async (fileUrlOrKey: string): Promise<string | null> => {
  const key = toObjectKey(fileUrlOrKey);
  if (!key) return null;

  try {
    const { data, error } = await nexus.storage.from(BOOK_FILES_BUCKET).download(key);
    if (error || !data) return null;

    // download() resolves to a Blob; an object URL keeps the bytes in memory so
    // the file is never written to disk by the borrow path.
    return URL.createObjectURL(data as Blob);
  } catch {
    return null;
  }
};

/**
 * Pulls the object key out of whatever was stored on the book row.
 *
 * Older rows hold a full public URL; newer ones hold a bare key. Accepting both
 * avoids a migration over rows that may still be in flight.
 */
export const toObjectKey = (fileUrlOrKey: string): string | null => {
  if (!fileUrlOrKey) return null;
  if (!fileUrlOrKey.startsWith('http')) return fileUrlOrKey;

  // .../objects/<url-encoded key>  — the shape the storage API serves.
  const marker = '/objects/';
  const at = fileUrlOrKey.indexOf(marker);
  if (at === -1) return null;

  const raw = fileUrlOrKey.slice(at + marker.length).split('?')[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};
