/**
 * @file memberPhotos — builds client-side URLs for OSM's public, unauthenticated
 *   member photo CDN. No API call or auth token is required to fetch these
 *   images; the URL is derived entirely from the scoutid and the member's
 *   photo_guid (both already present on member records returned by OSM).
 */

const MEMBER_PHOTO_BASE_URL =
  'https://www.onlinescoutmanager.co.uk/sites/onlinescoutmanager.co.uk/public/member_photos';

/**
 * Build the OSM CDN URL for a member's profile photo.
 *
 * OSM buckets photos into directories keyed by the first 4 characters of the
 * scoutid followed by '000' (a 7-character directory bucket), e.g. scoutid
 * `1234567` lives under `1234000/1234567/{photo_guid}/`.
 *
 * @param {number|string|null|undefined} scoutid - Member's OSM scout id
 * @param {string|null|undefined} photoGuid - Member's photo_guid from OSM
 * @param {'125x125'|'250x250'} [size='125x125'] - Pixel dimensions variant to request
 * @returns {string|null} The photo URL, or `null` if scoutid/photoGuid is missing
 */
export function buildMemberPhotoUrl(scoutid, photoGuid, size = '125x125') {
  if (!scoutid || !photoGuid) return null;

  const scoutIdStr = String(scoutid);
  const photoStart = `${scoutIdStr.slice(0, 4)}000`;

  return `${MEMBER_PHOTO_BASE_URL}/${photoStart}/${scoutIdStr}/${photoGuid}/${size}_0.jpg`;
}
