import React from 'react';
import PulseLoader from 'react-spinners/PulseLoader';

const Spinner: React.FC = () => {
  return (
    <div className="spinner-container">
      <PulseLoader color="#000" size={25} speedMultiplier={0.5} />
    </div>
  );
};

export default Spinner;
