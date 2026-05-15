import React from 'react';
import '../styling/circle.css';

interface SignCircleProps {
  id: string;
  selected: boolean;
  onClick: (id: string) => void;
}

const OP_CLASS: Record<string, string> = {
  '+': 'circle-op-plus',
  '-': 'circle-op-minus',
  '×': 'circle-op-times',
  '÷': 'circle-op-div',
};

const SignCircle: React.FC<SignCircleProps> = ({ id, selected, onClick }) => {
  return (
    <button
      className={`Circle ${OP_CLASS[id] ?? ''}${selected ? ' selected' : ''}`}
      id={`sign-${id}`}
      onClick={() => onClick(id)}
      style={selected ? { transform: 'scale(1.13) translateY(-5px)' } : undefined}
    >
      {id}
    </button>
  );
};

export default SignCircle;
