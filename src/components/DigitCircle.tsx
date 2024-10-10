import React from 'react';
import '../styling/circle.css';

interface DigitCircleProps {
  id: number;
  value: number;
  shown: boolean;
  selected: boolean;
  onClick: (id: number) => void;
}

const DigitCircle: React.FC<DigitCircleProps> = ({ id, value, shown, selected, onClick }) => {
  return (
    <a className={`Circle${shown ? '' : '-Hidden'}`} onClick={() => onClick(id)} style={selected ? { backgroundColor: '#51a594' } : { backgroundColor: '#1f7a6e' }}>
      {value}
    </a>
  );
};

export default DigitCircle;
