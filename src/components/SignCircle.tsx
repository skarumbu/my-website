import React from 'react';
import '../styling/circle.css';

interface SignCircleProps {
  id: string;
  selected: boolean;
  onClick: (id: string) => void;
}

const SignCircle: React.FC<SignCircleProps> = ({ id, selected, onClick }) => {
  return (
    <a className='Circle' onClick={() => onClick(id)} style={selected ? { backgroundColor: '#bdcc77' } : { backgroundColor: '#8fa143' }}>
      {id}
    </a>
  );
};

export default SignCircle;
