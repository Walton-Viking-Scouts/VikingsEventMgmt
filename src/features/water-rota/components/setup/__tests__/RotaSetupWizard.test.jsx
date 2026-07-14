import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../../shared/services/storage/database.js', () => ({
  default: { getSections: vi.fn() },
}));

vi.mock('../../../../../shared/services/storage/currentActiveTermsService.js', () => ({
  CurrentActiveTermsService: { getCurrentActiveTerm: vi.fn() },
}));

vi.mock('../../../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

vi.mock('../../../../../shared/utils/notifications.js', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('../../../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { APP: 'APP', API: 'API' },
}));

vi.mock('../../../../../shared/services/api/api/index.js', () => ({
  getTerms: vi.fn(),
}));

vi.mock('../../../services/programmeService.js', () => ({
  fetchProgrammeMeetings: vi.fn(),
}));

vi.mock('../../../services/rotaSetupService.js', () => ({
  createOrCompleteRota: vi.fn(),
  writeRotaConfig: vi.fn(),
}));

vi.mock('../../../services/rotaService.js', () => ({
  discoverRotaRecords: vi.fn(),
  findHostSection: vi.fn(),
  loadRota: vi.fn(),
  prefillRegulars: vi.fn(),
}));

vi.mock('../../../hooks/useRotaIdentity.js', () => ({
  getCurrentUserName: vi.fn(async () => 'Test Leader'),
}));

vi.mock('../../../hooks/useSectionYPCounts.js', () => ({
  useSectionYPCounts: () => ({ counts: {}, loading: false }),
}));

const leaderState = vi.hoisted(() => ({ candidates: {} }));

vi.mock('../../../hooks/useSectionLeaders.js', () => ({
  useSectionLeaders: () => ({ candidates: leaderState.candidates, loading: false }),
}));

import databaseService from '../../../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../../../shared/services/storage/currentActiveTermsService.js';
import { getTerms } from '../../../../../shared/services/api/api/index.js';
import { fetchProgrammeMeetings } from '../../../services/programmeService.js';
import { createOrCompleteRota, writeRotaConfig } from '../../../services/rotaSetupService.js';
import { discoverRotaRecords, findHostSection, loadRota, prefillRegulars } from '../../../services/rotaService.js';
import { notifyError, notifySuccess } from '../../../../../shared/utils/notifications.js';
import { buildSessionColumnName } from '../../../services/rotaEncoding.js';
import RotaSetupWizard from '../RotaSetupWizard.jsx';

const HOST_SECTION = { sectionid: 11107, sectionname: 'Adults', section: 'adults' };
const YOUTH_SECTION = { sectionid: 49097, sectionname: 'Scouts', section: 'scouts' };
const OTHER_YOUTH_SECTION = { sectionid: 23456, sectionname: 'Cubs', section: 'cubs' };

function renderWizard(initialEntries = ['/water-rota/setup']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RotaSetupWizard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  leaderState.candidates = {};
  databaseService.getSections.mockResolvedValue([HOST_SECTION, YOUTH_SECTION]);
  findHostSection.mockImplementation((sections) => sections.find((s) => s.sectionid === HOST_SECTION.sectionid) ?? null);
  discoverRotaRecords.mockResolvedValue([]);
  getTerms.mockResolvedValue({
    [String(YOUTH_SECTION.sectionid)]: [
      { termid: 'T-49097', name: 'Summer 2026', startdate: '2026-04-01', enddate: '2026-08-31' },
    ],
  });
  CurrentActiveTermsService.getCurrentActiveTerm.mockImplementation(async (sectionId) => {
    if (String(sectionId) === String(YOUTH_SECTION.sectionid)) {
      return { currentTermId: 'T-49097' };
    }
    if (String(sectionId) === String(HOST_SECTION.sectionid)) {
      return { currentTermId: 'HOST-T1' };
    }
    return null;
  });
  fetchProgrammeMeetings.mockResolvedValue([]);
  createOrCompleteRota.mockResolvedValue({
    success: true,
    flexirecordid: 'REC1',
    errors: [],
    addedFields: [],
  });
  loadRota.mockResolvedValue({
    recordId: 'REC1',
    hostSection: HOST_SECTION,
    termId: 'HOST-T1',
    sectionId: String(YOUTH_SECTION.sectionid),
    planningTermId: 'T-49097',
    seasonBucket: 'Summer 2026',
    configFieldId: 'f_1',
    config: null,
    sessions: [],
    members: [
      { scoutid: '200', name: 'Later Member' },
      { scoutid: '100', name: 'Anchor Member' },
    ],
  });
  writeRotaConfig.mockResolvedValue(undefined);
  prefillRegulars.mockResolvedValue({ errors: [] });
});

describe('RotaSetupWizard — single-section create', () => {
  it('defaults step 1 to the first youth section and its own current term', async () => {
    renderWizard();

    // "Adults" also appears as a section-picker option, so disambiguate the
    // read-only host-section paragraph specifically.
    await waitFor(() => expect(screen.getAllByText('Adults').some((el) => el.tagName === 'P')).toBe(true));
    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(YOUTH_SECTION.sectionid)));
    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
    expect(screen.getByLabelText('First week').value).toBe('2026-04-01');
    expect(screen.getByLabelText('Last week').value).toBe('2026-08-31');
  });

  it('creates the section\'s own record with the right identity and writes its config to the anchor row', async () => {
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));

    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));
    await waitFor(() => expect(fetchProgrammeMeetings).toHaveBeenCalledWith(
      String(YOUTH_SECTION.sectionid), 'T-49097', 'test-token',
    ));

    await screen.findByText('No programme found — using a weekly slot');
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByRole('button', { name: 'Create rota' });
    fireEvent.click(screen.getByRole('button', { name: 'Create rota' }));

    await waitFor(() => expect(createOrCompleteRota).toHaveBeenCalledTimes(1));
    expect(createOrCompleteRota).toHaveBeenCalledWith(
      expect.objectContaining({
        hostSection: HOST_SECTION,
        hostTermId: 'HOST-T1',
        record: {
          sectionId: String(YOUTH_SECTION.sectionid),
          sectionName: 'Scouts',
          termId: 'T-49097',
          seasonBucket: 'Summer 2026',
        },
        token: 'test-token',
      }),
    );
    expect(createOrCompleteRota.mock.calls[0][0].sessions.length).toBeGreaterThan(0);

    await waitFor(() => expect(writeRotaConfig).toHaveBeenCalledTimes(1));
    expect(writeRotaConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        hostSection: HOST_SECTION,
        recordId: 'REC1',
        termId: 'HOST-T1',
        // The plan config is written to the deterministic anchor row (lowest
        // scoutid), not the operator's own row.
        scoutid: '100',
        by: 'Test Leader',
        cfg: expect.objectContaining({ sid: String(YOUTH_SECTION.sectionid), sname: 'Scouts', start: '2026-04-01', end: '2026-08-31' }),
        // Re-running setup is an intentional full-plan replace, not a patch.
        replace: true,
      }),
    );

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Water rota saved'));
  });

  it('picks the anchor row by lexicographic (not numeric) scoutid order — mixed-width ids', async () => {
    // '99' sorts AFTER '100' lexicographically ('1' < '9'), the opposite of
    // numeric order — this pins that the deterministic anchor-row choice is
    // a string sort (String.prototype.localeCompare), not a numeric one.
    loadRota.mockResolvedValue({
      recordId: 'REC1',
      hostSection: HOST_SECTION,
      termId: 'HOST-T1',
      sectionId: String(YOUTH_SECTION.sectionid),
      planningTermId: 'T-49097',
      seasonBucket: 'Summer 2026',
      configFieldId: 'f_1',
      config: null,
      sessions: [],
      members: [
        { scoutid: '99', name: 'Numerically First' },
        { scoutid: '100', name: 'Lexicographically First' },
      ],
    });

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));
    await screen.findByText('No programme found — using a weekly slot');
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByRole('button', { name: 'Create rota' });
    fireEvent.click(screen.getByRole('button', { name: 'Create rota' }));

    await waitFor(() => expect(writeRotaConfig).toHaveBeenCalledTimes(1));
    expect(writeRotaConfig).toHaveBeenCalledWith(
      expect.objectContaining({ scoutid: '100' }),
    );
  });

  it('drops the previous section\'s regulars and plan when the planning section changes', async () => {
    databaseService.getSections.mockResolvedValue([HOST_SECTION, YOUTH_SECTION, OTHER_YOUTH_SECTION]);
    getTerms.mockResolvedValue({
      [String(YOUTH_SECTION.sectionid)]: [
        { termid: 'T-49097', name: 'Summer 2026', startdate: '2026-04-01', enddate: '2026-08-31' },
      ],
      [String(OTHER_YOUTH_SECTION.sectionid)]: [
        { termid: 'T-23456', name: 'Summer 2026', startdate: '2026-04-06', enddate: '2026-08-24' },
      ],
    });
    CurrentActiveTermsService.getCurrentActiveTerm.mockImplementation(async (sectionId) => {
      if (String(sectionId) === String(YOUTH_SECTION.sectionid)) {
        return { currentTermId: 'T-49097' };
      }
      if (String(sectionId) === String(OTHER_YOUTH_SECTION.sectionid)) {
        return { currentTermId: 'T-23456' };
      }
      if (String(sectionId) === String(HOST_SECTION.sectionid)) {
        return { currentTermId: 'HOST-T1' };
      }
      return null;
    });
    leaderState.candidates = {
      [String(YOUTH_SECTION.sectionid)]: [{ scoutid: '300', name: 'Reg Leader' }],
      [String(OTHER_YOUTH_SECTION.sectionid)]: [{ scoutid: '300', name: 'Reg Leader' }],
    };

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));
    const toggle = await screen.findByRole('button', { name: /Reg Leader/ });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Reg Leader/ }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: String(OTHER_YOUTH_SECTION.sectionid) } });
    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-23456'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));

    const freshToggle = await screen.findByRole('button', { name: /Reg Leader/ });
    expect(freshToggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('pre-selects the section named in ?section= (as set by the board\'s "Edit plan" link)', async () => {
    databaseService.getSections.mockResolvedValue([HOST_SECTION, YOUTH_SECTION, OTHER_YOUTH_SECTION]);
    getTerms.mockResolvedValue({
      [String(YOUTH_SECTION.sectionid)]: [
        { termid: 'T-49097', name: 'Summer 2026', startdate: '2026-04-01', enddate: '2026-08-31' },
      ],
      [String(OTHER_YOUTH_SECTION.sectionid)]: [
        { termid: 'T-23456', name: 'Summer 2026', startdate: '2026-04-06', enddate: '2026-08-24' },
      ],
    });
    CurrentActiveTermsService.getCurrentActiveTerm.mockImplementation(async (sectionId) => {
      if (String(sectionId) === String(YOUTH_SECTION.sectionid)) {
        return { currentTermId: 'T-49097' };
      }
      if (String(sectionId) === String(OTHER_YOUTH_SECTION.sectionid)) {
        return { currentTermId: 'T-23456' };
      }
      if (String(sectionId) === String(HOST_SECTION.sectionid)) {
        return { currentTermId: 'HOST-T1' };
      }
      return null;
    });

    renderWizard([`/water-rota/setup?section=${OTHER_YOUTH_SECTION.sectionid}`]);

    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(OTHER_YOUTH_SECTION.sectionid)));
    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-23456'));
    expect(screen.getByLabelText('First week').value).toBe('2026-04-06');
    expect(screen.getByLabelText('Last week').value).toBe('2026-08-24');
  });

  it('falls back to the default section when ?section= names a section the leader can\'t see', async () => {
    renderWizard(['/water-rota/setup?section=999999']);

    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(YOUTH_SECTION.sectionid)));
    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
  });

  it('falls back to the default section when ?section= names the Adults host section', async () => {
    renderWizard([`/water-rota/setup?section=${HOST_SECTION.sectionid}`]);

    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(YOUTH_SECTION.sectionid)));
    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
  });

  it('falls back to the default section when ?section= names a waiting-list section', async () => {
    const waitingList = { sectionid: 55555, sectionname: 'Scouts Waiting List', section: 'scouts' };
    databaseService.getSections.mockResolvedValue([HOST_SECTION, waitingList, YOUTH_SECTION]);

    renderWizard([`/water-rota/setup?section=${waitingList.sectionid}`]);

    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(YOUTH_SECTION.sectionid)));
    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
  });
});

describe('RotaSetupWizard — re-edit record identity (B1)', () => {
  it('sources sectionName and seasonBucket from the existing descriptor, not the live section name/range, on re-edit', async () => {
    // The section was renamed in OSM since the record was created, and the
    // live date range recomputes to a different season bucket than the one
    // baked into the original record's name.
    const renamedSection = { sectionid: YOUTH_SECTION.sectionid, sectionname: 'Scouts Renamed', section: 'scouts' };
    databaseService.getSections.mockResolvedValue([HOST_SECTION, renamedSection]);
    const existingDescriptor = {
      sectionId: String(renamedSection.sectionid),
      termId: 'T-49097',
      sectionName: 'Scouts',
      seasonBucket: 'Spring 2026',
      recordId: 'REC-EXIST',
      hostSection: HOST_SECTION,
    };
    discoverRotaRecords.mockResolvedValue([existingDescriptor]);

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));
    await screen.findByText('No programme found — using a weekly slot');
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByRole('button', { name: 'Create rota' });
    fireEvent.click(screen.getByRole('button', { name: 'Create rota' }));

    await waitFor(() => expect(createOrCompleteRota).toHaveBeenCalledTimes(1));
    expect(createOrCompleteRota).toHaveBeenCalledWith(
      expect.objectContaining({
        record: {
          sectionId: String(renamedSection.sectionid),
          sectionName: 'Scouts',
          termId: 'T-49097',
          seasonBucket: 'Spring 2026',
        },
      }),
    );
  });
});

describe('RotaSetupWizard — init failure recovery (B2/B6)', () => {
  it('shows a retryable error (not "no existing rota") when discovery fails, and retry recovers', async () => {
    discoverRotaRecords.mockRejectedValueOnce(new Error('network down'));

    renderWizard();

    await screen.findByText(/Couldn.t load setup data/);
    expect(screen.getByText(/network down/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Section')).not.toBeInTheDocument();

    discoverRotaRecords.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(YOUTH_SECTION.sectionid)));
  });

  it('shows the same retryable error state when getSections() fails (init has no unhandled path)', async () => {
    databaseService.getSections.mockRejectedValueOnce(new Error('db closed'));

    renderWizard();

    await screen.findByText(/Couldn.t load setup data/);
    expect(screen.getByText(/db closed/)).toBeInTheDocument();
  });
});

describe('RotaSetupWizard — seed-from-existing failure blocks create (B3)', () => {
  it('disables Create when the existing plan fails to load, and a successful retry unblocks it', async () => {
    const existingDescriptor = {
      sectionId: String(YOUTH_SECTION.sectionid),
      termId: 'T-49097',
      sectionName: 'Scouts',
      seasonBucket: 'Summer 2026',
      recordId: 'REC-EXIST',
      hostSection: HOST_SECTION,
    };
    discoverRotaRecords.mockResolvedValue([existingDescriptor]);
    loadRota.mockRejectedValueOnce(new Error('read failed'));

    renderWizard();

    await screen.findByText(/Couldn.t load this section.s existing plan/);
    expect(notifyError).toHaveBeenCalledWith('Couldn\'t load this section\'s existing plan — retry before editing');

    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));
    await screen.findByText('No programme found — using a weekly slot');
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByRole('button', { name: 'Create rota' });
    expect(screen.getByRole('button', { name: 'Create rota' })).toBeDisabled();
    expect(createOrCompleteRota).not.toHaveBeenCalled();

    loadRota.mockResolvedValue({
      recordId: 'REC-EXIST',
      hostSection: HOST_SECTION,
      termId: 'HOST-T1',
      sectionId: String(YOUTH_SECTION.sectionid),
      planningTermId: 'T-49097',
      seasonBucket: 'Summer 2026',
      config: null,
      sessions: [],
      members: [
        { scoutid: '200', name: 'Later Member' },
        { scoutid: '100', name: 'Anchor Member' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading the existing plan' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Create rota' })).not.toBeDisabled());
  });
});

describe('RotaSetupWizard — term loading (B4)', () => {
  it('shows a retryable error when the term fetch fails, distinct from "this section has no terms"', async () => {
    getTerms.mockRejectedValueOnce(new Error('OSM down'));

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(YOUTH_SECTION.sectionid)));
    await screen.findByText(/Couldn.t load terms for this section/);
    expect(screen.getByText(/OSM down/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: review programme' })).toBeDisabled();

    getTerms.mockResolvedValueOnce({
      [String(YOUTH_SECTION.sectionid)]: [
        { termid: 'T-49097', name: 'Summer 2026', startdate: '2026-04-01', enddate: '2026-08-31' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
  });

  it('shows an explanatory "no terms" message (not a silently-disabled button) when the section genuinely has none', async () => {
    getTerms.mockResolvedValue({ [String(YOUTH_SECTION.sectionid)]: [] });

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Section').value).toBe(String(YOUTH_SECTION.sectionid)));
    await screen.findByText(/This section has no terms set up in OSM/);
    expect(screen.getByRole('button', { name: 'Next: review programme' })).toBeDisabled();
  });
});

describe('RotaSetupWizard — programme fetch failure stays on step 1 (B5)', () => {
  it('does not advance to step 2 on a programme fetch failure, and never claims "no programme found"', async () => {
    fetchProgrammeMeetings.mockRejectedValueOnce(new Error('rate limited'));

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Couldn\'t read the programme — try again'));
    expect(screen.queryByText('No programme found — using a weekly slot')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: review programme' })).toBeInTheDocument();
  });
});

describe('RotaSetupWizard — re-edit seeding (T1)', () => {
  it('seeds range/act/st/en/k/p/regulars and reconstructs excluded overrides from {c:1}; saved excluded wins over the heuristic; switching section away and back re-seeds', async () => {
    databaseService.getSections.mockResolvedValue([HOST_SECTION, YOUTH_SECTION, OTHER_YOUTH_SECTION]);
    getTerms.mockResolvedValue({
      [String(YOUTH_SECTION.sectionid)]: [
        { termid: 'T-49097', name: 'Summer 2026', startdate: '2026-04-01', enddate: '2026-08-31' },
      ],
      [String(OTHER_YOUTH_SECTION.sectionid)]: [
        { termid: 'T-23456', name: 'Summer 2026', startdate: '2026-04-06', enddate: '2026-08-24' },
      ],
    });
    CurrentActiveTermsService.getCurrentActiveTerm.mockImplementation(async (sectionId) => {
      if (String(sectionId) === String(YOUTH_SECTION.sectionid)) {
        return { currentTermId: 'T-49097' };
      }
      if (String(sectionId) === String(OTHER_YOUTH_SECTION.sectionid)) {
        return { currentTermId: 'T-23456' };
      }
      if (String(sectionId) === String(HOST_SECTION.sectionid)) {
        return { currentTermId: 'HOST-T1' };
      }
      return null;
    });

    const existingDescriptor = {
      sectionId: String(YOUTH_SECTION.sectionid),
      termId: 'T-49097',
      sectionName: 'Scouts',
      seasonBucket: 'Summer 2026',
      recordId: 'REC-EXIST',
      hostSection: HOST_SECTION,
    };
    discoverRotaRecords.mockResolvedValue([existingDescriptor]);
    leaderState.candidates = {
      [String(YOUTH_SECTION.sectionid)]: [{ scoutid: '300', name: 'Reg Leader' }],
      [String(OTHER_YOUTH_SECTION.sectionid)]: [{ scoutid: '300', name: 'Reg Leader' }],
    };
    const excludedColumn = buildSessionColumnName('2026-04-16', String(YOUTH_SECTION.sectionid));
    loadRota.mockImplementation(async (descriptor) => {
      if (String(descriptor.sectionId) === String(YOUTH_SECTION.sectionid) && descriptor.termId === 'T-49097') {
        return {
          recordId: 'REC-EXIST',
          hostSection: HOST_SECTION,
          termId: 'HOST-T1',
          sectionId: String(YOUTH_SECTION.sectionid),
          planningTermId: 'T-49097',
          seasonBucket: 'Summer 2026',
          config: {
            cfg: {
              start: '2026-04-08',
              end: '2026-08-20',
              act: 'Canoeing',
              st: '17:45',
              en: '19:15',
              k: 18,
              p: 4,
              regulars: ['300'],
              sessions: { [excludedColumn]: { c: 1 } },
            },
          },
          sessions: [],
          members: [
            { scoutid: '200', name: 'Later Member' },
            { scoutid: '100', name: 'Anchor Member' },
          ],
        };
      }
      return { config: null, sessions: [], members: [] };
    });
    fetchProgrammeMeetings.mockImplementation(async (sectionId) => {
      if (String(sectionId) === String(YOUTH_SECTION.sectionid)) {
        // Looks like a water session by title, so the heuristic alone would
        // include it — the seeded config's {c:1} override must still win.
        return [{ date: '2026-04-16', title: 'Kayaking practice', startTime: '18:00', endTime: '19:30' }];
      }
      return [];
    });

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('First week').value).toBe('2026-04-08'));
    expect(screen.getByLabelText('Last week').value).toBe('2026-08-20');

    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));

    const toggle = await screen.findByRole('button', { name: /Reg Leader/ });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByDisplayValue('Canoeing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('17:45')).toBeInTheDocument();
    expect(screen.getByDisplayValue('19:15')).toBeInTheDocument();
    expect(screen.getByLabelText(`Expected young people for ${YOUTH_SECTION.sectionname}`).value).toBe('18');
    expect(screen.getByLabelText(`Permit holders needed for ${YOUTH_SECTION.sectionname}`).value).toBe('4');
    expect(screen.getByLabelText(/Kayaking practice/)).not.toBeChecked();

    // Switch away — plan resets to defaults for the newly chosen section.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: String(OTHER_YOUTH_SECTION.sectionid) } });
    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-23456'));
    expect(screen.getByLabelText('First week').value).toBe('2026-04-06');

    // Switch back — seededKeyRef was cleared by handleSectionChange, so the
    // seed pass re-runs instead of leaving the section's plan at defaults.
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: String(YOUTH_SECTION.sectionid) } });
    await waitFor(() => expect(screen.getByLabelText('First week').value).toBe('2026-04-08'));
    expect(screen.getByLabelText('Last week').value).toBe('2026-08-20');
  });
});

describe('RotaSetupWizard — prefill routing (T2)', () => {
  it('prefills regulars on exactly the newly-added subset of sessions, and surfaces a partial pre-fill failure', async () => {
    const YOUTH_SID = String(YOUTH_SECTION.sectionid);
    const dateA = '2026-04-07';
    const dateB = '2026-04-14';
    const colA = buildSessionColumnName(dateA, YOUTH_SID);

    fetchProgrammeMeetings.mockResolvedValue([
      { date: dateA, title: 'Kayaking Night' },
      { date: dateB, title: 'Canoe Night' },
    ]);
    leaderState.candidates = { [YOUTH_SID]: [{ scoutid: '300', name: 'Reg Leader' }] };
    createOrCompleteRota.mockResolvedValue({
      success: true,
      flexirecordid: 'REC1',
      errors: [],
      // Only dateA's column was newly created this run (dateB pre-existed).
      addedFields: [colA],
    });
    const reloadedSessions = [
      { fieldId: 'f_10', date: dateA, sectionId: YOUTH_SID },
      { fieldId: 'f_11', date: dateB, sectionId: YOUTH_SID },
    ];
    loadRota.mockResolvedValue({
      recordId: 'REC1',
      hostSection: HOST_SECTION,
      termId: 'HOST-T1',
      sectionId: YOUTH_SID,
      planningTermId: 'T-49097',
      seasonBucket: 'Summer 2026',
      config: null,
      sessions: reloadedSessions,
      members: [
        { scoutid: '200', name: 'Later Member' },
        { scoutid: '100', name: 'Anchor Member' },
      ],
    });
    prefillRegulars.mockResolvedValue({ errors: [{ fieldId: 'f_10', error: 'write failed' }] });

    renderWizard();

    await waitFor(() => expect(screen.getByLabelText('Term').value).toBe('T-49097'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: review programme' }));
    const toggle = await screen.findByRole('button', { name: /Reg Leader/ });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByRole('button', { name: 'Create rota' });
    fireEvent.click(screen.getByRole('button', { name: 'Create rota' }));

    await waitFor(() => expect(prefillRegulars).toHaveBeenCalledTimes(1));
    expect(prefillRegulars).toHaveBeenCalledWith({
      rota: expect.objectContaining({ recordId: 'REC1' }),
      regularsBySection: { [YOUTH_SID]: ['300'] },
      token: 'test-token',
      // Exactly the strict subset named in addedFields — dateB's existing
      // session must not be re-touched (would clobber withdrawals).
      sessions: [reloadedSessions[0]],
    });

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(
      'Rota saved, but 1 session couldn\'t be pre-filled with regulars — open them to add manually.',
    ));
  });
});
