import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { API: 'API', APP: 'APP', ERROR: 'ERROR' },
}));

vi.mock('../../../shared/services/api/api/flexiRecords.js', () => ({
  createFlexiRecord: vi.fn(),
  addFlexiColumn: vi.fn(),
}));

vi.mock('../../events/services/flexiRecordService.js', () => ({
  getFlexiRecordsList: vi.fn(),
  getFlexiRecordStructure: vi.fn(),
}));

import { createFlexiRecord, addFlexiColumn } from '../../../shared/services/api/api/flexiRecords.js';
import { getFlexiRecordsList, getFlexiRecordStructure } from '../../events/services/flexiRecordService.js';
import { createOrCompleteFlexiRecord } from '../services/flexiRecordCreationService.js';
import { VIKING_SECTION_MOVERS } from '../services/flexiRecordTemplates.js';

const section = { sectionid: 42, sectionname: 'Beavers' };
const template = VIKING_SECTION_MOVERS;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOrCompleteFlexiRecord', () => {
  it('creates the FlexiRecord and adds every template field when none exist', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({ items: [] });
    createFlexiRecord.mockResolvedValueOnce({ flexirecordid: 9001, name: template.name });
    addFlexiColumn.mockResolvedValue({ columnid: 'f_1', name: 'Some Field' });
    getFlexiRecordsList.mockResolvedValue({ items: [] });
    getFlexiRecordStructure.mockResolvedValue({ fieldMapping: {} });

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.success).toBe(true);
    expect(result.createdRecord).toBe(true);
    expect(result.flexirecordid).toBe(9001);
    expect(result.addedFields).toEqual(template.fields);
    expect(createFlexiRecord).toHaveBeenCalledTimes(1);
    expect(addFlexiColumn).toHaveBeenCalledTimes(template.fields.length);
  });

  it('accepts createFlexiRecord responses that use extraid instead of flexirecordid', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({ items: [] });
    createFlexiRecord.mockResolvedValueOnce({ extraid: 5555 });
    addFlexiColumn.mockResolvedValue({});
    getFlexiRecordsList.mockResolvedValue({ items: [] });
    getFlexiRecordStructure.mockResolvedValue({ fieldMapping: {} });

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.success).toBe(true);
    expect(result.flexirecordid).toBe(5555);
  });

  it('treats addFlexiColumn responses with an error key as a per-field failure', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({ items: [] });
    createFlexiRecord.mockResolvedValueOnce({ flexirecordid: 1 });
    addFlexiColumn.mockResolvedValue({ error: 'Permission denied' });
    getFlexiRecordsList.mockResolvedValue({ items: [] });
    getFlexiRecordStructure.mockResolvedValue({ fieldMapping: {} });

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(template.fields.length);
    expect(result.errors[0].error).toBe('Permission denied');
  });

  it('bails with a meta error when createFlexiRecord returns no id', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({ items: [] });
    createFlexiRecord.mockResolvedValueOnce({ error: 'Permission denied' });

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.success).toBe(false);
    expect(result.errors[0].field).toBe('_meta');
    expect(addFlexiColumn).not.toHaveBeenCalled();
  });

  it('skips creation and only adds the missing fields when the record already exists', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({
      items: [{ name: template.name, extraid: 7777 }],
    });
    getFlexiRecordStructure.mockResolvedValueOnce({
      fieldMapping: {
        f_1: { name: 'AssignedSection' },
        f_2: { name: 'AssignedTerm' },
      },
    });
    addFlexiColumn.mockResolvedValue({});
    getFlexiRecordsList.mockResolvedValue({ items: [{ name: template.name, extraid: 7777 }] });
    getFlexiRecordStructure.mockResolvedValue({ fieldMapping: {} });

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.createdRecord).toBe(false);
    expect(result.flexirecordid).toBe(7777);
    expect(createFlexiRecord).not.toHaveBeenCalled();
    expect(addFlexiColumn).toHaveBeenCalledTimes(template.fields.length - 2);
    const addedNames = addFlexiColumn.mock.calls.map(c => c[2]);
    expect(addedNames).not.toContain('AssignedSection');
    expect(addedNames).not.toContain('AssignedTerm');
    expect(result.success).toBe(true);
  });

  it('is a no-op when the record already has every template field', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({
      items: [{ name: template.name, extraid: 5 }],
    });
    getFlexiRecordStructure.mockResolvedValueOnce({
      fieldMapping: Object.fromEntries(
        template.fields.map((name, idx) => [`f_${idx}`, { name }]),
      ),
    });
    getFlexiRecordsList.mockResolvedValue({ items: [{ name: template.name, extraid: 5 }] });
    getFlexiRecordStructure.mockResolvedValue({ fieldMapping: {} });

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.success).toBe(true);
    expect(result.createdRecord).toBe(false);
    expect(result.addedFields).toEqual([]);
    expect(createFlexiRecord).not.toHaveBeenCalled();
    expect(addFlexiColumn).not.toHaveBeenCalled();
  });

  it('records per-field errors when addFlexiColumn fails midway and returns partial success', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({ items: [] });
    createFlexiRecord.mockResolvedValueOnce({ flexirecordid: 1 });
    addFlexiColumn
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue({});
    getFlexiRecordsList.mockResolvedValue({ items: [] });
    getFlexiRecordStructure.mockResolvedValue({ fieldMapping: {} });

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ field: template.fields[1], error: 'rate limited' });
    expect(result.addedFields).toContain(template.fields[0]);
    expect(result.addedFields).not.toContain(template.fields[1]);
    expect(result.flexirecordid).toBe(1);
  });

  it('returns a meta error when the token is missing', async () => {
    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: '' });
    expect(result.success).toBe(false);
    expect(result.errors[0].field).toBe('_meta');
    expect(getFlexiRecordsList).not.toHaveBeenCalled();
  });

  it('bails with a meta error if structure fetch fails on an existing record (avoids re-adding existing columns)', async () => {
    getFlexiRecordsList.mockResolvedValueOnce({
      items: [{ name: template.name, extraid: 4242 }],
    });
    getFlexiRecordStructure.mockRejectedValueOnce(new Error('OSM unavailable'));

    const result = await createOrCompleteFlexiRecord({ section, template, termId: 'T1', token: 'tok' });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('_meta');
    expect(result.errors[0].error).toContain('OSM unavailable');
    expect(addFlexiColumn).not.toHaveBeenCalled();
  });
});
