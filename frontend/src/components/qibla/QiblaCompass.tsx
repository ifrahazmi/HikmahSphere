import React from 'react';
import './QiblaCompass.css';

interface QiblaCompassProps {
  qiblaBearing: number | null;
  currentHeading: number;
  noCompassAvailable: boolean;
  statusText: string;
  isAligned: boolean;
  isLowAccuracy: boolean;
  isCalibrating: boolean;
  locationAccuracyMeters: number | null;
  permissionHelpMessage: string | null;
  distanceKm: number | null;
  userLat: number | null;
  userLng: number | null;
  onCompassCircleClick: () => void;
  darkMode?: boolean;
}

const degreeText = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return '--';
  return `${Math.round(value)}°`;
};

const QiblaCompass: React.FC<QiblaCompassProps> = ({
  qiblaBearing,
  currentHeading,
  noCompassAvailable,
  statusText,
  isAligned,
  isLowAccuracy,
  isCalibrating,
  locationAccuracyMeters,
  permissionHelpMessage,
  distanceKm,
  userLat,
  userLng,
  onCompassCircleClick,
  darkMode = false,
}) => {
  const compassRotation = noCompassAvailable ? 0 : -currentHeading;
  const indicatorRotation = qiblaBearing === null ? 0 : noCompassAvailable ? qiblaBearing : qiblaBearing - currentHeading;
  const liveHeading = noCompassAvailable ? null : currentHeading;

  const ticks: JSX.Element[] = [];
  for (let i = 0; i < 360; i += 5) {
    const isMajor = i % 30 === 0;
    const isMinor = i % 15 === 0;
    const len = isMajor ? 12 : isMinor ? 8 : 4;
    const r = 125;
    const rad = ((i - 90) * Math.PI) / 180;
    const x1 = 130 + (r - len) * Math.cos(rad);
    const y1 = 130 + (r - len) * Math.sin(rad);
    const x2 = 130 + r * Math.cos(rad);
    const y2 = 130 + r * Math.sin(rad);
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isMajor ? 'rgba(201,168,76,0.6)' : 'rgba(240,237,230,0.15)'}
        strokeWidth={isMajor ? 1.5 : 0.8}
      />
    );
  }

  const tone = darkMode ? 'dark' : 'light';
  const valuesAligned = isAligned && !noCompassAvailable;
  const statusLevelClass = permissionHelpMessage ? 'blocked' : isLowAccuracy ? 'warning' : isAligned ? 'active' : '';
  const ringClass = isLowAccuracy && !noCompassAvailable ? 'low-accuracy' : isAligned && !noCompassAvailable ? 'aligned' : '';

  return (
    <div className={`qibla-compass-card ${tone}`}>
      <div className={`qibla-status-bar ${tone}`}>
        <span className={`qibla-status-dot ${statusLevelClass}`} />
        {statusText}
      </div>

      <div
        className="qibla-compass-wrapper"
        role="button"
        tabIndex={0}
        onClick={onCompassCircleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCompassCircleClick();
          }
        }}
        title="Tap to retry compass permission or calibrate"
      >
        <div className={`qibla-compass-ring ${ringClass}`} />
        <div className="qibla-top-pointer" />
        <div className="qibla-compass-inner">
          <div className="qibla-compass-plate" style={{ transform: `rotate(${compassRotation}deg)` }}>
            <svg viewBox="0 0 260 260">
              <g>{ticks}</g>
              <text x="130" y="32" textAnchor="middle" fill="#E5484D" fontFamily="DM Sans" fontSize="15" fontWeight="600">N</text>
              <text x="236" y="135" textAnchor="middle" fill="rgba(240,237,230,0.5)" fontFamily="DM Sans" fontSize="13" fontWeight="500">E</text>
              <text x="130" y="238" textAnchor="middle" fill="rgba(240,237,230,0.5)" fontFamily="DM Sans" fontSize="13" fontWeight="500">S</text>
              <text x="24" y="135" textAnchor="middle" fill="rgba(240,237,230,0.5)" fontFamily="DM Sans" fontSize="13" fontWeight="500">W</text>
            </svg>
          </div>
          <div
            className="qibla-indicator"
            style={{ transform: `rotate(${indicatorRotation}deg)` }}
          >
            <div className="qibla-arrow">
              <div className="kaaba-icon">🕋</div>
              <div className="arrow-line" />
            </div>
          </div>
          <div className={`qibla-center-marker ${tone}`}>
            {darkMode ? (
              <div className="qibla-center-dot" />
            ) : (
              <img src="/logo.png" alt="HikmahSphere" className="qibla-center-logo" />
            )}
          </div>
        </div>
      </div>

      {isLowAccuracy && !noCompassAvailable && (
        <p className="qibla-calibration-hint">
          {isCalibrating
            ? 'Calibrating compass...'
            : 'Low accuracy detected. Tap compass or press Calibrate and move phone in a figure-8 motion.'}
        </p>
      )}

      {locationAccuracyMeters !== null && (
        <p className="qibla-accuracy-readout">GPS accuracy: {Math.round(locationAccuracyMeters)}m</p>
      )}

      {permissionHelpMessage && <p className="qibla-permission-help">{permissionHelpMessage}</p>}

      <div className="qibla-degree-pair">
        <div className={`qibla-degree-chip ${tone} ${valuesAligned ? 'glow' : ''}`}>
          <div className="qibla-degree-chip-label">Live Heading</div>
          <div className="qibla-degree-chip-value">{degreeText(liveHeading)}</div>
        </div>
        <div className={`qibla-degree-chip ${tone} ${valuesAligned ? 'glow' : ''}`}>
          <div className="qibla-degree-chip-label">Qibla Bearing</div>
          <div className="qibla-degree-chip-value">{degreeText(qiblaBearing)}</div>
        </div>
      </div>
      <div className={`qibla-alignment-msg ${isAligned && !noCompassAvailable ? 'visible' : ''}`}>Facing the Kaaba ✦</div>

      <div className="qibla-info-grid">
        <div className={`qibla-info-card ${tone}`}>
          <div className="qibla-info-label">Distance</div>
          <div className={`qibla-info-value ${tone}`}>{distanceKm !== null ? `${distanceKm.toFixed(0)} km` : '--'}</div>
        </div>
        <div className={`qibla-info-card ${tone}`}>
          <div className="qibla-info-label">Heading</div>
          <div className={`qibla-info-value ${tone}`}>{degreeText(currentHeading)}</div>
        </div>
        <div className={`qibla-info-card ${tone}`}>
          <div className="qibla-info-label">Latitude</div>
          <div className={`qibla-info-value ${tone}`}>{userLat !== null ? userLat.toFixed(4) : '--'}</div>
        </div>
        <div className={`qibla-info-card ${tone}`}>
          <div className="qibla-info-label">Longitude</div>
          <div className={`qibla-info-value ${tone}`}>{userLng !== null ? userLng.toFixed(4) : '--'}</div>
        </div>
      </div>
    </div>
  );
};

export default QiblaCompass;
