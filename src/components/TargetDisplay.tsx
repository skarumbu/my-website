import React from 'react';

interface TargetDisplayProps {
  target: number;
}

const TargetDisplay: React.FC<TargetDisplayProps> = ({ target }) => {
  return (
    <div className='Row' style={{ color: '#1f7a6e' }}>
      Target: {target}
    </div>
  );
};

export default TargetDisplay;
