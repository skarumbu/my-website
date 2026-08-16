import React from 'react';
import '../styling/writing-cursor.css';

const WritingCursor: React.FC = () => {
  return (
    <div className="writing-cursor-container">
      <span className="writing-cursor-label">Loading</span>
      <span className="writing-cursor-caret" aria-hidden="true" />
    </div>
  );
};

export default WritingCursor;
