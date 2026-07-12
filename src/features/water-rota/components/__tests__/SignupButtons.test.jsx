import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SignupButtons from '../SignupButtons.jsx';
import { SIGNUP_STATUS } from '../../services/rotaEncoding.js';

describe('SignupButtons', () => {
  it('requests IN when not signed up', () => {
    const onChange = vi.fn();
    render(<SignupButtons myStatus={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('I\'m in'));
    expect(onChange).toHaveBeenCalledWith(SIGNUP_STATUS.IN);
  });

  it('tapping the active pill withdraws', () => {
    const onChange = vi.fn();
    render(<SignupButtons myStatus={SIGNUP_STATUS.IN} onChange={onChange} />);

    fireEvent.click(screen.getByText('✓ I\'m in'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('switches between confirmed and backup', () => {
    const onChange = vi.fn();
    render(<SignupButtons myStatus={SIGNUP_STATUS.IN} onChange={onChange} />);

    fireEvent.click(screen.getByText('Backup'));
    expect(onChange).toHaveBeenCalledWith(SIGNUP_STATUS.BACKUP);
  });

  it('disables both pills when disabled', () => {
    const onChange = vi.fn();
    render(<SignupButtons myStatus={null} disabled onChange={onChange} />);

    fireEvent.click(screen.getByText('I\'m in'));
    fireEvent.click(screen.getByText('Backup'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
