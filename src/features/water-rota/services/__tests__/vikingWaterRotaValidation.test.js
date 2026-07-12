import { describe, expect, it } from 'vitest';

import { validateWaterRotaStructure } from '../vikingWaterRotaValidation.js';
import { parseRotaRecordYear, buildRotaRecordName } from '../rotaTemplates.js';

describe('validateWaterRotaStructure', () => {
  it('accepts a structure with RotaConfig and session columns, ignoring strays', () => {
    const structure = {
      fieldMapping: {
        f_1: { name: 'RotaConfig', type: 'text' },
        f_2: { name: 'S_20260714_49097', type: 'text' },
        f_3: { name: 'S_20260602_49097', type: 'text' },
        f_4: { name: 'SomeStrayColumn', type: 'text' },
      },
    };

    const result = validateWaterRotaStructure(structure);
    expect(result.isValid).toBe(true);
    expect(result.configFieldId).toBe('f_1');
    expect(result.sessionColumns).toEqual([
      { fieldId: 'f_3', date: '2026-06-02', sectionId: '49097' },
      { fieldId: 'f_2', date: '2026-07-14', sectionId: '49097' },
    ]);
    expect(result.errors).toEqual([]);
  });

  it('fails without a RotaConfig column', () => {
    const result = validateWaterRotaStructure({
      fieldMapping: { f_1: { name: 'S_20260714_49097', type: 'text' } },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('RotaConfig');
  });

  it('fails safely on a missing structure', () => {
    expect(validateWaterRotaStructure(null).isValid).toBe(false);
    expect(validateWaterRotaStructure({}).isValid).toBe(false);
  });
});

describe('rota record naming', () => {
  it('round-trips the year', () => {
    expect(parseRotaRecordYear(buildRotaRecordName(2026))).toBe(2026);
  });

  it('rejects other record names', () => {
    expect(parseRotaRecordYear('Viking Event Mgmt')).toBeNull();
    expect(parseRotaRecordYear('Viking Water Rota')).toBeNull();
    expect(parseRotaRecordYear(null)).toBeNull();
  });
});
