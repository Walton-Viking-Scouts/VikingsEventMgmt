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
import { discoverRotaRecords, findHostSection, loadRota } from '../../../services/rotaService.js';
import { notifySuccess } from '../../../../../shared/utils/notifications.js';
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
