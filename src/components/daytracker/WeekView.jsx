import { getDateStr, getDayStats } from './storage';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WeekView({ onDaySelect }) {
  const today = getDateStr();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getDateStr(d);
    const stats = getDayStats(dateStr);
    days.push({
      date: dateStr,
      dayName: DAYS[d.getDay()],
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: dateStr === today,
      ...stats
    });
  }

  return (
    <div>
      <p className="section-header">Last 7 days</p>
      {days.map(day => (
        <div
          key={day.date}
          className={`week-day ${day.isToday ? 'today' : ''}`}
          onClick={() => onDaySelect(day.date)}
        >
          <div className="week-day-name">
            {day.dayName}{day.isToday ? ' (Today)' : ''}
          </div>
          <div className="week-day-date">{day.month} {day.dayNum}</div>
          <div className="week-stat">
            {day.logged > 0 ? `${day.logged}h logged` : 'no logs'}
          </div>
          <div className="week-energy">
            {day.avgEnergy > 0 ? `${day.avgEnergy} energy` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

export default WeekView;
