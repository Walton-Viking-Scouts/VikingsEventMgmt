import { describe, it, expect } from 'vitest';
import { isNotPhotoConsentYes } from '../SectionsList.jsx';

describe('isNotPhotoConsentYes', () => {
  it('returns false when photographs consent is Yes', () => {
    expect(isNotPhotoConsentYes({ photographs: 'Yes' })).toBe(false);
  });

  it('returns false when photographs consent is Yes regardless of case', () => {
    expect(isNotPhotoConsentYes({ photographs: 'yes' })).toBe(false);
    expect(isNotPhotoConsentYes({ Photographs: 'YES' })).toBe(false);
  });

  it('returns true when photographs consent is No', () => {
    expect(isNotPhotoConsentYes({ photographs: 'No' })).toBe(true);
  });

  it('returns true when photographs consent is empty', () => {
    expect(isNotPhotoConsentYes({ photographs: '' })).toBe(true);
  });

  it('returns true when photographs consent is missing entirely', () => {
    expect(isNotPhotoConsentYes({})).toBe(true);
    expect(isNotPhotoConsentYes(undefined)).toBe(true);
  });

  it('checks the capitalized Photographs key when photographs is absent', () => {
    expect(isNotPhotoConsentYes({ Photographs: 'Yes' })).toBe(false);
    expect(isNotPhotoConsentYes({ Photographs: 'No' })).toBe(true);
  });

  it('prefers the lowercase photographs key when both are present', () => {
    expect(isNotPhotoConsentYes({ photographs: 'Yes', Photographs: 'No' })).toBe(false);
  });
});
