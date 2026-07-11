import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/rotaService.js', () => ({
  assignSignup: vi.fn(async () => undefined),
  writeSessionMeta: vi.fn(async () => undefined),
}));

vi.mock('../../services/rotaSetupService.js', () => ({
  activateWaterSession: vi.fn(async () => ({})),
}));

vi.mock('../../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'tok'),
}));

vi.mock('../../../../shared/utils/notifications.js', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

import SessionDetailModal from '../SessionDetailModal.jsx';
import { assignSignup } from '../../services/rotaService.js';
import { activateWaterSession } from '../../services/rotaSetupService.js';
import { notifyError, notifySuccess } from '../../../../shared/utils/notifications.js';
import { SIGNUP_STATUS } from '../../services/rotaEncoding.js';

const IDENTITY = { scoutid: '10', name: 'Simon Clark' };

function makeSession(overrides = {}) {
  return {
    fieldId: 'f_5',
    date: '2026-07-14',
    sectionId: '49097',
    sectionName: 'Cubs',
    activity: 'Kayaking',
    startTime: '18:15',
    endTime: '19:30',
    kids: 24,
    needed: 3,
    notes: '',
    cancelled: false,
    hasMeta: true,
    confirmed: [],
    backups: [],
    ...overrides,
  };
}

const ROTA = {
  hostSection: { sectionid: '1' },
  year: 2026,
  termId: 'term-1',
  members: [
    { scoutid: '10', name: 'Simon Clark' },
    { scoutid: '30', name: 'New Permit Holder' },
  ],
};

const baseProps = {
  rota: ROTA,
  identity: IDENTITY,
  canEdit: true,
  sectionYPCount: 24,
  myStatus: null,
  signupPending: false,
  onSignupChange: vi.fn(),
  refresh: vi.fn(async () => undefined),
  onClose: vi.fn(),
};

describe('SessionDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets a plan editor put a config-only week on the water', async () => {
    const refresh = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(
      <SessionDetailModal
        {...baseProps}
        session={makeSession({ fieldId: null, hasMeta: false })}
        refresh={refresh}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('This programme week isn\'t on the water yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Put on the water'));
    fireEvent.click(screen.getByText('Put on the water'));

    await waitFor(() => expect(activateWaterSession).toHaveBeenCalledTimes(1));

    expect(activateWaterSession).toHaveBeenCalledWith(
      expect.objectContaining({
        rota: ROTA,
        date: '2026-07-14',
        sectionId: '49097',
        by: IDENTITY.name,
        scoutid: IDENTITY.scoutid,
        token: 'tok',
        fields: expect.objectContaining({ act: 'Kayaking', st: '18:15', en: '19:30' }),
      }),
    );
    expect(notifySuccess).toHaveBeenCalledWith('Session put on the water');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('activates a config-only week that is ALSO cancelled (render-order regression)', async () => {
    render(
      <SessionDetailModal
        {...baseProps}
        session={makeSession({ fieldId: null, hasMeta: false, cancelled: true })}
      />,
    );

    fireEvent.click(screen.getByText('Put on the water'));

    expect(await screen.findByLabelText('Activity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Put on the water' })).toBeInTheDocument();
    expect(screen.queryByText('Not on water this week.')).not.toBeInTheDocument();
  });

  it('lets a plan editor remove a confirmed signup', async () => {
    const refresh = vi.fn(async () => undefined);
    render(
      <SessionDetailModal
        {...baseProps}
        session={makeSession({ confirmed: [{ scoutid: '30', name: 'New Permit Holder' }] })}
        refresh={refresh}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove New Permit Holder from this session'));

    await waitFor(() => expect(assignSignup).toHaveBeenCalledTimes(1));
    expect(assignSignup).toHaveBeenCalledWith({
      rota: ROTA,
      fieldId: 'f_5',
      scoutid: '30',
      status: null,
      token: 'tok',
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('hides the remove control when not a plan editor', () => {
    render(
      <SessionDetailModal
        {...baseProps}
        canEdit={false}
        session={makeSession({ confirmed: [{ scoutid: '30', name: 'New Permit Holder' }] })}
      />,
    );

    expect(screen.queryByLabelText('Remove New Permit Holder from this session')).not.toBeInTheDocument();
  });

  it('shows only an informational line when not a plan editor', () => {
    render(
      <SessionDetailModal
        {...baseProps}
        canEdit={false}
        session={makeSession({ fieldId: null, hasMeta: false })}
      />,
    );

    expect(screen.getByText('This programme week isn\'t on the water yet.')).toBeInTheDocument();
    expect(screen.queryByText('Put on the water')).not.toBeInTheDocument();
  });

  it('lets a plan editor add a permit holder to a live session', async () => {
    const refresh = vi.fn(async () => undefined);
    render(
      <SessionDetailModal
        {...baseProps}
        session={makeSession()}
        refresh={refresh}
      />,
    );

    fireEvent.click(screen.getByText('Add permit holder'));
    fireEvent.click(screen.getByTestId('add-permit-holder-row-30'));

    await waitFor(() => expect(assignSignup).toHaveBeenCalledTimes(1));

    expect(assignSignup).toHaveBeenCalledWith({
      rota: ROTA,
      fieldId: 'f_5',
      scoutid: '30',
      status: SIGNUP_STATUS.IN,
      token: 'tok',
    });
    expect(notifySuccess).toHaveBeenCalledWith('Permit holder added');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('blocks putting on the water without a picked identity', async () => {
    render(
      <SessionDetailModal
        {...baseProps}
        identity={null}
        session={makeSession({ fieldId: null, hasMeta: false })}
      />,
    );

    fireEvent.click(screen.getByText('Put on the water'));
    fireEvent.click(screen.getByText('Put on the water'));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(activateWaterSession).not.toHaveBeenCalled();
  });
});
