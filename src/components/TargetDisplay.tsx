import React from 'react';
import '../styling/target-display.css';

interface TargetDisplayProps {
  target: number;
}

const TargetDisplay: React.FC<TargetDisplayProps> = ({ target }) => {
  return (
    <div className="target-card">
      <div className="target-card-sticker">GET TO ↓</div>
      <div className="target-card-number">{target}</div>
    </div>
  );
};

export default TargetDisplay;
