import React from 'react';

import '../styling/target-display.css';

interface TargetDisplayProps {
  target: number;
}

const TargetDisplay: React.FC<TargetDisplayProps> = ({ target }) => {
  return (
    <div style={{ color: '#1f7a6e' }}>
      <div className = 'target-display-words'>
        Target Number
      </div>
      {target}
    </div>
  );
};

export default TargetDisplay;
