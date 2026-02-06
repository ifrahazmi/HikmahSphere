import React, { useState } from 'react';

const IslamicCalendar: React.FC = () => {
  const [currentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  // Get Hijri month name for the current view
  const hijriMonthName = new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
      month: 'long',
      year: 'numeric'
  }).format(currentDate);

  // Get weekday of the first day of the month (0-6)
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full border-l-4 border-emerald-500">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Islamic Calendar</h2>
      </div>
      
      <div className="mb-2">
        <div className="flex flex-col mb-4">
            <span className="text-lg font-semibold text-emerald-600">{hijriMonthName}</span>
            <span className="text-sm text-gray-500">{monthName} {year}</span>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="font-bold text-gray-400 py-2">{d}</div>
          ))}
          
          {/* Padding for start of month */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
             <div key={`empty-${i}`} />
          ))}

          {days.map(date => {
            const isToday = new Date().toDateString() === date.toDateString();
            // Get Hijri day number
            const hijriDay = new Intl.DateTimeFormat('en-TN-u-ca-islamic', { day: 'numeric' }).format(date);
            
            return (
              <div 
                key={date.toISOString()} 
                className={`p-2 rounded-lg flex flex-col items-center justify-center transition-colors ${
                  isToday 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'hover:bg-emerald-50 text-gray-700'
                }`}
              >
                <span className={`font-semibold ${isToday ? 'text-white' : 'text-gray-900'}`}>{date.getDate()}</span>
                <span className={`text-[10px] ${isToday ? 'text-emerald-100' : 'text-emerald-600'}`}>{hijriDay}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="text-xs text-center text-gray-400 mt-4 border-t pt-3">
        * Dates based on Umm al-Qura calendar
      </div>
    </div>
  );
};

export default IslamicCalendar;
