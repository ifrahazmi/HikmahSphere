import React from 'react';
import QuranText from './components/QuranText/QuranText';

function App() {
  return (
    <div className="app" style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Quran Display</h1>
      
      <QuranText
        arabicText="الحمد لله رب العالمين"
        ayahNumber={1}
      />
    </div>
  );
}

export default App;
