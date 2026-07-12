import React, { useState } from 'react';
import { ACTIVITY_PRESETS } from '../services/rotaTemplates.js';

/**
 * Session editing form for plan editors: activity preset chips with free
 * text, time inputs, expected-kids stepper (with reset to the section YP
 * total), permit-holders-needed stepper, and notes. The parent owns the
 * save (writeSessionMeta) and the not-on-water toggle.
 *
 * @param {Object} props
 * @param {import('../utils/rotaDisplay.js').SessionView} props.session - Current session view
 * @param {number|null} props.sectionYPCount - Section's total Young People (kids default)
 * @param {boolean} [props.saving] - Disable inputs while a save is in flight
 * @param {Function} props.onSave - Called with {act, st, en, k, p, n} on submit
 * @param {string} [props.submitLabel] - Submit button label when not saving
 * @returns {JSX.Element} Edit form
 */
function SessionEditForm({ session, sectionYPCount, saving = false, onSave, submitLabel = 'Save session' }) {
  const [activity, setActivity] = useState(session.activity ?? '');
  const [startTime, setStartTime] = useState(session.startTime ?? '18:30');
  const [endTime, setEndTime] = useState(session.endTime ?? '20:00');
  const [kids, setKids] = useState(session.kids ?? sectionYPCount ?? 0);
  const [needed, setNeeded] = useState(session.needed ?? 0);
  const [notes, setNotes] = useState(session.notes ?? '');

  const valid = activity.trim() !== '' && /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!valid || saving) {
      return;
    }
    onSave({
      act: activity.trim(),
      st: startTime,
      en: endTime,
      k: Math.max(0, Number(kids) || 0),
      p: Math.max(0, Number(needed) || 0),
      n: notes.trim(),
    });
  };

  const stepper = (value, setValue, label, testId) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={saving}
        onClick={() => setValue(Math.max(0, (Number(value) || 0) - 1))}
        className="h-9 w-9 rounded-full border border-gray-300 text-lg text-gray-700 hover:border-scout-blue disabled:opacity-50"
      >
        −
      </button>
      <input
        type="number"
        min="0"
        value={value}
        data-testid={testId}
        disabled={saving}
        onChange={(event) => setValue(Math.max(0, Number(event.target.value) || 0))}
        className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-scout-blue focus:outline-none"
        aria-label={label}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={saving}
        onClick={() => setValue((Number(value) || 0) + 1)}
        className="h-9 w-9 rounded-full border border-gray-300 text-lg text-gray-700 hover:border-scout-blue disabled:opacity-50"
      >
        +
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Activity</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ACTIVITY_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={saving}
              onClick={() => setActivity(preset)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                activity === preset
                  ? 'bg-scout-blue border-scout-blue text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-scout-blue'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={activity}
          disabled={saving}
          onChange={(event) => setActivity(event.target.value)}
          placeholder="Or type an activity…"
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
          aria-label="Activity"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700" htmlFor="rota-start-time">
            Start
          </label>
          <input
            id="rota-start-time"
            type="time"
            value={startTime}
            disabled={saving}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700" htmlFor="rota-end-time">
            End
          </label>
          <input
            id="rota-end-time"
            type="time"
            value={endTime}
            disabled={saving}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Expected young people</label>
        <div className="mt-1.5 flex items-center gap-3">
          {stepper(kids, setKids, 'expected young people', 'kids-input')}
          {sectionYPCount !== null && sectionYPCount !== undefined && Number(kids) !== sectionYPCount && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setKids(sectionYPCount)}
              className="text-xs text-scout-blue font-medium"
            >
              Section total: {sectionYPCount}
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Permit holders needed</label>
        <div className="mt-1.5">{stepper(needed, setNeeded, 'permit holders needed', 'needed-input')}</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="rota-notes">
          Notes
        </label>
        <textarea
          id="rota-notes"
          rows={2}
          value={notes}
          disabled={saving}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Launch point, tides, kit…"
          className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={!valid || saving}
        className="w-full py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark disabled:opacity-50"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

export default SessionEditForm;
