import React from 'react';
import './QuranText.css';

const QuranText = ({ arabicText, ayahNumber }) => {
  return (
    <div className="quran-container">
      {/* Ayah number badge on the right (RTL layout) */}
      <span className="ayah-badge">{ayahNumber}</span>
      
      {/* Quran text */}
      <span className="quran-text">{arabicText}</span>
    </div>
  );
};

export default QuranText;
