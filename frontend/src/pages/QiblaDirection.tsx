import React, { useEffect, useState } from 'react';
import { MoonIcon, SparklesIcon, SunIcon } from '@heroicons/react/24/outline';
import PageSEO from '../components/PageSEO';
import QiblaCompass from '../components/qibla/QiblaCompass';
import QiblaMap from '../components/qibla/QiblaMap';
import { useQiblaCompass } from '../hooks/useQiblaCompass';

const QiblaDirection: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem('qiblaTheme') === 'dark');
  const {
    isStarted,
    start,
    userLat,
    userLng,
    qiblaBearing,
    distanceKm,
    currentHeading,
    noCompassAvailable,
    statusText,
    gpsError,
    locationAccuracyMeters,
    isLowAccuracy,
    isCalibrating,
    permissionHelpMessage,
    isAligned,
    calibrateCompass,
  } = useQiblaCompass();

  useEffect(() => {
    localStorage.setItem('qiblaTheme', darkMode ? 'dark' : 'light');
    window.dispatchEvent(new Event('qiblaThemeChanged'));
  }, [darkMode]);

  return (
    <>
      <PageSEO
        title="Qibla Compass"
        description="Find accurate Qibla direction with live compass and GPS, plus offline map support to stay guided anywhere."
        path="/prayers/qibla"
        keywords={['qibla direction', 'qibla compass', 'kaaba direction', 'muslim compass']}
      />

      <div className={`min-h-screen pb-8 ${darkMode ? 'bg-[#0A0E17]' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
          <div className="mx-auto mb-6 max-w-5xl text-center">
            <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-between gap-3">
              <h1 className={`text-2xl font-bold sm:text-3xl md:text-4xl ${darkMode ? 'text-[#C9A84C]' : 'text-gray-900'}`}>Qibla Direction 🕋</h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={calibrateCompass}
                  aria-label="Calibrate compass"
                  title="Calibrate compass"
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition ${
                    isLowAccuracy
                      ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : darkMode
                      ? 'border-[#C9A84C]/50 bg-[#111827] text-[#E8D48B] hover:bg-[#1a2438]'
                      : 'border-sky-300 bg-white text-sky-700 hover:bg-sky-50'
                  }`}
                >
                  <SparklesIcon className={`h-5 w-5 ${isCalibrating ? 'animate-pulse' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setDarkMode((prev) => !prev)}
                  aria-label={darkMode ? 'Disable dark mode' : 'Enable dark mode'}
                  title={darkMode ? 'Disable dark mode' : 'Enable dark mode'}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition ${
                    darkMode
                      ? 'border-[#C9A84C]/50 bg-[#111827] text-[#E8D48B] hover:bg-[#1a2438]'
                      : 'border-sky-300 bg-white text-sky-700 hover:bg-sky-50'
                  }`}
                >
                  {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className={`mt-1 space-y-1 text-sm sm:text-base ${darkMode ? 'text-[#E8D48B]' : 'text-emerald-700'}`}>
              <p>Live Qibla Compass with GPS and Save map for offline use</p>
            </div>
          </div>

          {!isStarted && (
            <div className={`mx-auto mb-6 max-w-md rounded-2xl border p-6 text-center shadow-sm ${darkMode ? 'border-[#C9A84C]/30 bg-[#111827]' : 'border-emerald-100 bg-white'}`}>
              <button
                type="button"
                onClick={start}
                className="mt-4 rounded-full bg-gradient-to-r from-[#8B6914] to-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-[#0A0E17] transition hover:opacity-90"
              >
                Enable Compass
              </button>
            </div>
          )}

          {gpsError && (
            <div className="mx-auto mb-5 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {gpsError}
            </div>
          )}

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <QiblaCompass
              qiblaBearing={qiblaBearing}
              currentHeading={currentHeading}
              noCompassAvailable={noCompassAvailable}
              statusText={statusText}
              isAligned={isAligned}
              isLowAccuracy={isLowAccuracy}
              isCalibrating={isCalibrating}
              locationAccuracyMeters={locationAccuracyMeters}
              permissionHelpMessage={permissionHelpMessage}
              distanceKm={distanceKm}
              userLat={userLat}
              userLng={userLng}
              onCompassCircleClick={calibrateCompass}
              darkMode={darkMode}
            />

            <QiblaMap
              userLat={userLat}
              userLng={userLng}
              currentHeading={currentHeading}
              noCompassAvailable={noCompassAvailable}
              darkMode={darkMode}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default QiblaDirection;
