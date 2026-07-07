import { describe, it, expect } from 'vitest';
import { buildMemberPhotoUrl } from '../memberPhotos.js';

describe('buildMemberPhotoUrl', () => {
  it('builds a 125x125 URL by default', () => {
    const url = buildMemberPhotoUrl(1234567, 'abc-guid');
    expect(url).toBe(
      'https://www.onlinescoutmanager.co.uk/sites/onlinescoutmanager.co.uk/public/member_photos/1234000/1234567/abc-guid/125x125_0.jpg',
    );
  });

  it('builds a 250x250 URL when requested', () => {
    const url = buildMemberPhotoUrl(1234567, 'abc-guid', '250x250');
    expect(url).toBe(
      'https://www.onlinescoutmanager.co.uk/sites/onlinescoutmanager.co.uk/public/member_photos/1234000/1234567/abc-guid/250x250_0.jpg',
    );
  });

  it('derives the photoStart bucket from the first 4 characters of scoutid', () => {
    const url = buildMemberPhotoUrl(9876543, 'guid');
    expect(url).toContain('/9876000/9876543/guid/');
  });

  it('accepts scoutid as a string', () => {
    const url = buildMemberPhotoUrl('1234567', 'abc-guid');
    expect(url).toContain('/1234000/1234567/abc-guid/');
  });

  it('returns null when scoutid is missing', () => {
    expect(buildMemberPhotoUrl(null, 'abc-guid')).toBeNull();
    expect(buildMemberPhotoUrl(undefined, 'abc-guid')).toBeNull();
  });

  it('returns null when photoGuid is missing', () => {
    expect(buildMemberPhotoUrl(1234567, null)).toBeNull();
    expect(buildMemberPhotoUrl(1234567, undefined)).toBeNull();
    expect(buildMemberPhotoUrl(1234567, '')).toBeNull();
  });
});
