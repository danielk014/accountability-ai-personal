import { useState } from 'react';
import { getDateStr, getDayStats } from './storage';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function CalendarView({ onDaySelect }) {
  const today = getDateStr();
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startDow; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const stats = getDayStats(dateStr);
    cells.push({ day: d, dateStr, ...stats, isToday: dateStr === today });
  }

  function shiftMonth(delta) {
    const d = new Date(year, month + delta, 1);
    setViewDate(d);
  }

  function goToday() {
    setViewDate(new Date());
  }

  return (
    <div>
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={() => shiftMonth(-1)}>&larr;</button>
        <div className="cal-title">
          <span className="cal-month">{MONTH_NAMES[month]}</span>
          <span className="cal-year">{year}</span>
        </div>
        <button className="cal-nav-btn" onClick={() => shiftMonth(1)}>&rarr;</button>
      </div>

      <button className="cal-today-btn" onClick={goToday}>Today</button>

      <div className="cal-grid">
        {DAY_NAMES.map(d => (
          <div key={d} className="cal-day-name">{d}</div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="cal-cell empty" />;

          const hasLogs = cell.logged > 0;
          const energyLevel = cell.avgEnergy > 0 ? Math.round(cell.avgEnergy) : 0;

          return (
            <div
              key={cell.dateStr}
              className={`cal-cell ${cell.isToday ? 'today' : ''} ${hasLogs ? 'has-logs' : ''}`}
              onClick={() => onDaySelect(cell.dateStr)}
            >
              <span className="cal-day-num">{cell.day}</span>
              {hasLogs && (
                <div className="cal-cell-info">
                  <span className="cal-cell-hours">{cell.logged}h</span>
                  {energyLevel > 0 && (
                    <div className="cal-cell-energy">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={`cal-energy-pip ${i <= energyLevel ? 'filled' : ''}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarView;
