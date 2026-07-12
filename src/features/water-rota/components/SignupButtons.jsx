import React from 'react';
import { SIGNUP_STATUS } from '../services/rotaEncoding.js';

/**
 * One-tap signup pills for a session: "I'm in" and "Backup". Tapping the
 * active pill withdraws. Parent decides whether a withdrawal needs
 * confirmation before calling onChange.
 *
 * @param {Object} props
 * @param {string|null} props.myStatus - Current signup ('I', 'B', or null)
 * @param {boolean} [props.disabled] - Disable both pills (offline / no identity / pending)
 * @param {boolean} [props.pending] - Show the in-flight state
 * @param {Function} props.onChange - Called with the requested status ('I', 'B', or null to withdraw)
 * @returns {JSX.Element} Signup pill row
 */
function SignupButtons({ myStatus, disabled = false, pending = false, onChange }) {
  const isIn = myStatus === SIGNUP_STATUS.IN;
  const isBackup = myStatus === SIGNUP_STATUS.BACKUP;

  const base =
    'flex-1 py-1.5 px-3 rounded-full text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={`flex gap-2 ${pending ? 'animate-pulse' : ''}`} data-testid="signup-buttons">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isIn}
        onClick={() => onChange(isIn ? null : SIGNUP_STATUS.IN)}
        className={`${base} ${
          isIn
            ? 'bg-scout-blue border-scout-blue text-white'
            : 'bg-white border-gray-300 text-gray-700 hover:border-scout-blue hover:text-scout-blue'
        }`}
      >
        {isIn ? '✓ I\'m in' : 'I\'m in'}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isBackup}
        onClick={() => onChange(isBackup ? null : SIGNUP_STATUS.BACKUP)}
        className={`${base} ${
          isBackup
            ? 'bg-gray-700 border-gray-700 text-white'
            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-500'
        }`}
      >
        {isBackup ? '✓ Backup' : 'Backup'}
      </button>
    </div>
  );
}

export default SignupButtons;
