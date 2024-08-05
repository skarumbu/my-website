import React from 'react';
import '../styling/circle.css';

interface SignCircleProps {
  id: string;
  selected: boolean;
  onClick: (id: string) => void;
}

const SignCircle: React.FC<SignCircleProps> = ({ id, selected, onClick }) => {
  const getSignCharacter = (sign: string) => {
    switch (sign) {
      case '+': return '＋';
      case '-': return '−';
      case '*': return '×';
      case '/': return '÷';
      default: return sign;
    }
  };

  return (
    <span className='Circle' onClick={() => onClick(id)} style={selected ? { backgroundColor: '#bdcc77' } : { backgroundColor: '#8fa143' }}>
      {getSignCharacter(id)}
    </span>
  );
};

export default SignCircle;
