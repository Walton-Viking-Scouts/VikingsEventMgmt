import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SessionEditForm from '../SessionEditForm.jsx';
import { COVER_STATUS } from '../../utils/rotaDisplay.js';

function makeSession(overrides = {}) {
  return {
    fieldId: 'f_2',
    date: '2026-07-14',
    sectionId: '49097',
    sectionName: 'Cubs',
    activity: 'Kayaking',
    startTime: '18:15',
    endTime: '19:30',
    kids: 24,
    needed: 3,
    notes: 'Bring wetsuits',
    cancelled: false,
    hasMeta: true,
    confirmed: [],
    backups: [],
    status: COVER_STATUS.SHORT,
    ...overrides,
  };
}

describe('SessionEditForm', () => {
  it('saves the edited fields', () => {
    const onSave = vi.fn();
    render(<SessionEditForm session={makeSession()} sectionYPCount={30} onSave={onSave} />);

    fireEvent.click(screen.getByText('Paddleboarding'));
    fireEvent.change(screen.getByTestId('needed-input'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Save session'));

    expect(onSave).toHaveBeenCalledWith({
      act: 'Paddleboarding',
      st: '18:15',
      en: '19:30',
      k: 24,
      p: 4,
      n: 'Bring wetsuits',
    });
  });

  it('resets kids to the section total', () => {
    const onSave = vi.fn();
    render(<SessionEditForm session={makeSession()} sectionYPCount={30} onSave={onSave} />);

    fireEvent.click(screen.getByText('Section total: 30'));
    fireEvent.click(screen.getByText('Save session'));

    expect(onSave.mock.calls[0][0].k).toBe(30);
  });

  it('defaults kids to the section total for a fresh session', () => {
    const onSave = vi.fn();
    render(
      <SessionEditForm
        session={makeSession({ kids: null, activity: '', needed: null, notes: '' })}
        sectionYPCount={22}
        onSave={onSave}
      />,
    );

    expect(screen.getByTestId('kids-input')).toHaveValue(22);
  });

  it('blocks saving without an activity', () => {
    const onSave = vi.fn();
    render(
      <SessionEditForm
        session={makeSession({ activity: '' })}
        sectionYPCount={30}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByText('Save session'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('never lets steppers go negative', () => {
    const onSave = vi.fn();
    render(
      <SessionEditForm
        session={makeSession({ needed: 0 })}
        sectionYPCount={30}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByLabelText('Decrease permit holders needed'));
    expect(screen.getByTestId('needed-input')).toHaveValue(0);
  });
});
