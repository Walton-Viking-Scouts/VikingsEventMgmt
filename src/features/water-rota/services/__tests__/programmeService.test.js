import { describe, expect, it } from 'vitest';

import { normalizeProgrammeMeetings } from '../programmeService.js';

describe('normalizeProgrammeMeetings', () => {
  it('normalizes a typical OSM programme summary item', () => {
    const meetings = normalizeProgrammeMeetings([
      {
        eveningid: '8785585',
        title: '  Water night  ',
        meetingdate: '2026-06-02',
        starttime: '18:15:00',
        endtime: '19:30:00',
      },
    ]);

    expect(meetings).toEqual([
      {
        eveningid: '8785585',
        title: 'Water night',
        date: '2026-06-02',
        startTime: '18:15',
        endTime: '19:30',
      },
    ]);
  });

  it('tolerates missing time fields — summary payloads may omit them', () => {
    const meetings = normalizeProgrammeMeetings([
      { eveningid: 1, title: 'No times', meetingdate: '2026-06-09' },
    ]);
    expect(meetings[0].startTime).toBeNull();
    expect(meetings[0].endTime).toBeNull();
    expect(meetings[0].eveningid).toBe('1');
  });

  it('accepts UK dd/mm/yyyy dates and ISO dates with time suffixes', () => {
    const meetings = normalizeProgrammeMeetings([
      { meetingdate: '14/07/2026' },
      { meetingdate: '2026-06-02 00:00:00' },
    ]);
    expect(meetings.map((m) => m.date)).toEqual(['2026-06-02', '2026-07-14']);
  });

  it('drops items without a parseable date and handles empty input', () => {
    expect(normalizeProgrammeMeetings([{ title: 'No date' }, { meetingdate: 'soon' }])).toEqual([]);
    expect(normalizeProgrammeMeetings(undefined)).toEqual([]);
    expect(normalizeProgrammeMeetings(null)).toEqual([]);
  });

  it('normalizes blank titles to null and sorts by date', () => {
    const meetings = normalizeProgrammeMeetings([
      { meetingdate: '2026-06-16', title: '' },
      { meetingdate: '2026-06-02', title: 'First' },
    ]);
    expect(meetings.map((m) => m.date)).toEqual(['2026-06-02', '2026-06-16']);
    expect(meetings[0].title).toBe('First');
    expect(meetings[1].title).toBeNull();
  });
});
