import React from 'react';
import '../../styling/circle.css';

interface DigitCircleProps {
  id: number;
  value: number;
  shown: boolean;
  selected: boolean;
  onClick: (id: number) => void;
}

const CANDY_COLORS = ['mint', 'butter', 'sky', 'lilac', 'coral', 'peach', 'rose', 'grass'];
const TILTS = [-6, 4, -3, 7, -5, 3, -7, 5];

const DigitCircle: React.FC<DigitCircleProps> = ({ id, value, shown, selected, onClick }) => {
  const colorName = CANDY_COLORS[id % CANDY_COLORS.length];
  const tilt = TILTS[id % TILTS.length];

  const baseTransform = `rotate(${tilt}deg)`;
  const selectedTransform = `rotate(${tilt}deg) scale(1.13) translateY(-5px)`;

  return (
    <button
      className={`Circle circle-${colorName}${shown ? '' : ' Circle-Hidden'}`}
      id={`number-${id}`}
      onClick={() => onClick(id)}
      style={{
        transform: selected ? selectedTransform : baseTransform,
        boxShadow: selected
          ? `0 8px 16px rgba(0,0,0,0.22)`
          : undefined,
      }}
    >
      {value}
    </button>
  );
};

export default DigitCircle;
