import { useState, useEffect } from 'react';
import { loadGoals, saveGoals, loadLongTermGoals, saveLongTermGoals } from './storage';

function GoalList({ goals, onUpdate, onRemove, onAdd, placeholder }) {
  return (
    <>
      {goals.map((goal, i) => (
        <div key={i} className="goal-item">
          <span className="goal-num">{i + 1}.</span>
          <input
            className="goal-input"
            value={goal}
            onChange={e => {
              const next = [...goals];
              next[i] = e.target.value;
              onUpdate(next);
            }}
            placeholder={placeholder}
          />
          <button className="goal-delete" onClick={() => onRemove(i)}>
            &times;
          </button>
        </div>
      ))}
      <button className="add-goal" onClick={onAdd}>
        + Add a goal
      </button>
    </>
  );
}

function GoalsView() {
  const [goals, setGoals] = useState([]);
  const [longTermGoals, setLongTermGoals] = useState([]);

  useEffect(() => {
    setGoals(loadGoals());
    setLongTermGoals(loadLongTermGoals());
  }, []);

  function updateGoals(next) {
    setGoals(next);
    saveGoals(next);
  }

  function updateLongTerm(next) {
    setLongTermGoals(next);
    saveLongTermGoals(next);
  }

  return (
    <div>
      <p className="section-header">Long-Term Vision</p>
      <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
        Where do you want to be in 1, 3, 5, 10 years? The coach uses these to show you
        whether your daily actions match your trajectory.
      </p>

      <GoalList
        goals={longTermGoals}
        onUpdate={updateLongTerm}
        onRemove={i => updateLongTerm(longTermGoals.filter((_, j) => j !== i))}
        onAdd={() => updateLongTerm([...longTermGoals, ''])}
        placeholder="e.g. Own a business by 30, no debt, be in peak shape..."
      />

      <div style={{ borderTop: '1px solid #1a1a1a', margin: '24px 0 16px' }} />

      <p className="section-header">Current Goals</p>
      <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
        What matters right now, this week, this month. Be specific.
      </p>

      <GoalList
        goals={goals}
        onUpdate={updateGoals}
        onRemove={i => updateGoals(goals.filter((_, j) => j !== i))}
        onAdd={() => updateGoals([...goals, ''])}
        placeholder="e.g. Finish project proposal, run 5k, read 1 chapter..."
      />
    </div>
  );
}

export default GoalsView;
