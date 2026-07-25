const fs = require('fs');
const file = 'src/pages/DhikrDua.tsx';
let content = fs.readFileSync(file, 'utf8');

const tasbihStartStr = `            <aside className={\`space-y-6 lg:col-span-4 \${activeMobileSection === 'tasbih' ? 'block' : 'hidden lg:block'}\`}>
              <div id="tasbih-counter" ref={tasbihSectionRef} className={\`scroll-mt-24 rounded-2xl border p-5 shadow-sm lg:sticky lg:top-24 \${cardBg}\`}>
                <div className="mx-auto w-full max-w-md">
                  <h2 className={\`text-center text-xl font-bold \${headingText}\`}>Tasbih Counter</h2>`;
const tasbihEndStr = `                  </div>
                </div>
              </div>
            </aside>`;

const tasbihReplacement = `            <aside className={\`space-y-6 lg:col-span-4 \${activeMobileSection === 'tasbih' ? 'block' : 'hidden lg:block'}\`}>
              <div id="tasbih-counter" ref={tasbihSectionRef} className={\`scroll-mt-24 rounded-2xl border p-4 sm:p-5 shadow-sm lg:sticky lg:top-24 \${cardBg}\`}>
                <div className="mx-auto w-full max-w-md">
                  {/* Header */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-2xl">📿</span>
                    <h2 className={\`text-lg font-bold \${headingText}\`}>Tasbih Counter</h2>
                  </div>

                  {/* Dhikr Selector - Compact */}
                  <select
                    value={selectedPreset.id}
                    onChange={(event) => updatePreset(event.target.value)}
                    className={\`w-full rounded-lg border px-3 py-1.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-400 \${
                      isDarkMode
                        ? 'border-slate-600 bg-slate-800 text-slate-100'
                        : 'border-emerald-200 bg-white text-gray-900'
                    }\`}
                  >
                    {TASBIH_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>

                  {/* Current Dhikr Display */}
                  <div className={\`mt-3 rounded-xl border p-3 \${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-teal-50/50'}\`}>
                    <p className={\`text-center text-[11px] font-semibold uppercase tracking-wider \${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}\`}>Current Dhikr</p>
                    <p className={\`mt-0.5 text-center font-semibold \${selectedPreset.compact ? 'text-xs' : 'text-sm'} \${headingText}\`}>{selectedPreset.label}</p>
                    <p
                      className={\`mt-1 tasbih-arabic-text font-indopak-nastaleeq-v3 \${selectedPreset.compact ? 'text-lg leading-relaxed' : 'text-2xl'} \${
                      isDarkMode ? 'text-emerald-100' : 'text-emerald-900'
                      }\`}
                      dir="rtl"
                      lang="ar"
                      style={{
                        textRendering: 'auto',
                        WebkitFontSmoothing: 'subpixel-antialiased',
                        fontVariantLigatures: 'common-ligatures contextual',
                        fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                        letterSpacing: 0,
                        wordSpacing: '0.08em',
                      }}
                    >
                      {selectedPreset.arabic}
                    </p>
                    {selectedPreset.transliteration && (
                      <p className={\`mt-1 text-center text-[10px] italic leading-snug \${mutedText}\`}>
                        {selectedPreset.transliteration}
                      </p>
                    )}
                  </div>

                  {/* Tap Counter Button */}
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      if (event.pointerType === 'mouse' && event.button !== 0) return;
                      incrementTasbih();
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                    className="mx-auto mt-4 flex h-40 w-40 select-none touch-manipulation items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 text-center text-white shadow-lg ring-4 ring-emerald-200/30 transition-all duration-150 active:scale-95 active:shadow-md hover:shadow-xl hover:ring-emerald-300/50"
                  >
                    <div>
                      <p className="text-5xl font-bold tabular-nums">{tasbihCount}</p>
                      <p className="mt-0.5 text-xs font-medium opacity-80">Tap to Count</p>
                    </div>
                  </button>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] font-medium">
                      <span className={mutedText}>{tasbihCount} / {selectedPreset.target}</span>
                      <span className={\`font-bold \${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}\`}>{progressPercent}%</span>
                    </div>
                    <div className={\`h-2 w-full overflow-hidden rounded-full \${isDarkMode ? 'bg-slate-700' : 'bg-emerald-100'}\`}>
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out"
                        style={{ width: \`\${progressPercent}%\` }}
                      />
                    </div>
                    <p className={\`mt-1.5 text-center text-[11px] \${mutedText}\`}>
                      {completedCycles > 0 ? \`\${completedCycles} cycle\${completedCycles > 1 ? 's' : ''} completed ✓\` : \`Target: \${selectedPreset.target}\`}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={decrementTasbih}
                      className={\`inline-flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition \${
                        isDarkMode
                          ? 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-slate-100'
                          : 'border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50'
                      }\`}
                    >
                      ← Undo
                    </button>
                    <button
                      type="button"
                      onClick={resetTasbih}
                      className={\`inline-flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition \${
                        isDarkMode
                          ? 'border-slate-600 text-slate-300 hover:border-red-500 hover:text-red-400'
                          : 'border-emerald-200 text-emerald-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
                      }\`}
                    >
                      <ArrowPathIcon className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  </div>

                  {/* Today's Dhikr Tracker */}
                  <div className={\`mt-4 rounded-xl border p-3 \${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-emerald-100 bg-white'}\`}>
                    <h3 className={\`text-xs font-bold uppercase tracking-wider \${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}\`}>Today's Progress</h3>
                    <div className="mt-2 space-y-2">
                      {TASBIH_PRESETS.slice(0, 3).map((preset) => {
                        const count = dailyTracker.counts[preset.id] || 0;
                        const pct = Math.min(100, Math.round((count / preset.target) * 100));
                        return (
                          <div key={preset.id}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={\`text-[11px] font-medium \${mutedText}\`}>{preset.label}</span>
                              <span className={\`text-[11px] font-bold tabular-nums \${pct >= 100 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : headingText}\`}>
                                {count}/{preset.target} {pct >= 100 ? '✓' : ''}
                              </span>
                            </div>
                            <div className={\`h-1.5 w-full overflow-hidden rounded-full \${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}\`}>
                              <div
                                className={\`h-1.5 rounded-full transition-all duration-300 \${pct >= 100 ? 'bg-emerald-500' : 'bg-emerald-300'}\`}
                                style={{ width: \`\${pct}%\` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </aside>`;

const tasbihStartIdx = content.indexOf(tasbihStartStr);
const tasbihEndIdx = content.indexOf(tasbihEndStr, tasbihStartIdx) + tasbihEndStr.length;
if (tasbihStartIdx !== -1 && tasbihEndIdx !== -1) {
  content = content.substring(0, tasbihStartIdx) + tasbihReplacement + content.substring(tasbihEndIdx);
  console.log("Tasbih counter replaced!");
} else {
  console.log("Tasbih counter not found");
}

const desktopReminderStartStr = `                    <div className={\`rounded-xl border p-4 \${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-white'}\`}>
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">`;
const desktopReminderEndStr = `                            </label>
                          )}
                        </div>
                      </div>
                    </div>`;

const desktopReminderReplacement = `                    <div className={\`rounded-xl border p-4 sm:p-5 \${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-gradient-to-br from-amber-50/50 to-orange-50/50'}\`}>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🔔</span>
                          <div>
                            <h3 className={\`font-bold \${headingText}\`}>Dhikr &amp; Dua Reminder</h3>
                            <p className={\`text-xs \${mutedText}\`}>{reminderScheduleLabel}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => reminders.enabled ? disableReminderNotifications() : enableReminderNotifications()}
                          className={\`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 \${
                            reminders.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                          }\`}
                        >
                          <span
                            className={\`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out \${
                              reminders.enabled ? 'translate-x-5' : 'translate-x-0'
                            }\`}
                          />
                        </button>
                      </div>

                      {(!reminderSupport.supported || reminderSupport.reason || !canConfigureReminderSettings) && (
                        <div className={\`mb-4 rounded-lg border p-3 text-[11px] \${isDarkMode ? 'border-slate-600 bg-slate-900/50' : 'border-amber-200 bg-amber-50'}\`}>
                          <p className="font-semibold text-amber-600">Note on Notifications</p>
                          {!reminderSupport.supported && <p className="mt-1 text-slate-500">Your browser does not support notifications.</p>}
                          {reminderSupport.reason && <p className="mt-1 text-slate-500">{reminderSupport.reason}</p>}
                          {!canConfigureReminderSettings && reminderSupport.supported && (
                            <p className="mt-1 text-slate-500">Please enable the toggle above and grant permission to configure reminders.</p>
                          )}
                        </div>
                      )}

                      <div className={\`space-y-4 transition-opacity \${!canConfigureReminderSettings ? 'opacity-50 pointer-events-none' : ''}\`}>
                        <div>
                          <p className={\`mb-2 text-[11px] font-semibold uppercase tracking-wider \${mutedText}\`}>Include in Reminders</p>
                          <div className="flex gap-3">
                            <label className={\`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition \${
                              reminders.includeDhikr ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                            }\`}>
                              <input
                                type="checkbox"
                                checked={reminders.includeDhikr}
                                onChange={(event) => handleReminderTypeToggle('includeDhikr', event.target.checked)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm font-medium">Dhikr</span>
                            </label>
                            <label className={\`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition \${
                              reminders.includeDua ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                            }\`}>
                              <input
                                type="checkbox"
                                checked={reminders.includeDua}
                                onChange={(event) => handleReminderTypeToggle('includeDua', event.target.checked)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm font-medium">Dua</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <p className={\`mb-2 text-[11px] font-semibold uppercase tracking-wider \${mutedText}\`}>Schedule Type</p>
                          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => handleReminderScheduleTypeChange('periodic')}
                              className={\`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition \${
                                reminders.scheduleType === 'periodic'
                                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }\`}
                            >
                              Periodic
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReminderScheduleTypeChange('specific')}
                              className={\`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition \${
                                reminders.scheduleType === 'specific'
                                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }\`}
                            >
                              Specific Time
                            </button>
                          </div>
                        </div>

                        <div className={\`rounded-lg border p-3 \${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-white'}\`}>
                          {reminders.scheduleType === 'periodic' ? (
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">Frequency</span>
                              <select
                                value={reminders.periodicIntervalMinutes}
                                onChange={(event) => handleReminderIntervalChange(event.target.value)}
                                className={\`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 \${
                                  isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                                }\`}
                              >
                                {REMINDER_INTERVAL_OPTIONS.map((minutes) => (
                                  <option key={minutes} value={minutes}>
                                    Every {minutes} min
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">Time of day</span>
                              <input
                                type="time"
                                value={reminders.specificTime}
                                onChange={(event) => handleReminderTimeChange(event.target.value)}
                                className={\`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 \${
                                  isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                                }\`}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>`;

const drStartIdx = content.indexOf(desktopReminderStartStr);
// Need to find end index carefully. We search for desktopReminderEndStr AFTER drStartIdx
if (drStartIdx !== -1) {
    const drEndIdx = content.indexOf(desktopReminderEndStr, drStartIdx) + desktopReminderEndStr.length;
    if (content.indexOf(desktopReminderEndStr, drStartIdx) !== -1) {
        content = content.substring(0, drStartIdx) + desktopReminderReplacement + content.substring(drEndIdx);
        console.log("Desktop reminder replaced!");
    } else {
        console.log("Desktop reminder end not found");
    }
} else {
    console.log("Desktop reminder start not found");
}

const mobileReminderStartStr = `                <div className={\`mt-4 rounded-lg border px-3 py-2 text-xs \${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-emerald-200 bg-emerald-50'}\`}>
                  <p className={mutedText}>
                    Support: {reminderSupport.supported ? 'Available' : 'Not Available'} • Permission: {reminderPermissionLabel}`;

const mobileReminderEndStr = `                    </label>
                  )}

                </div>
              </div>
            )}`;
const mobileReminderReplacement = `                <div className={\`mt-6 rounded-xl border p-4 sm:p-5 \${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-gradient-to-br from-amber-50/50 to-orange-50/50'}\`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔔</span>
                      <div>
                        <h3 className={\`font-bold \${headingText}\`}>Dhikr &amp; Dua Reminder</h3>
                        <p className={\`text-xs \${mutedText}\`}>{reminderScheduleLabel}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => reminders.enabled ? disableReminderNotifications() : enableReminderNotifications()}
                      className={\`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 \${
                        reminders.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      }\`}
                    >
                      <span
                        className={\`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out \${
                          reminders.enabled ? 'translate-x-5' : 'translate-x-0'
                        }\`}
                      />
                    </button>
                  </div>

                  {(!reminderSupport.supported || reminderSupport.reason || !canConfigureReminderSettings) && (
                    <div className={\`mb-4 rounded-lg border p-3 text-[11px] \${isDarkMode ? 'border-slate-600 bg-slate-900/50' : 'border-amber-200 bg-amber-50'}\`}>
                      <p className="font-semibold text-amber-600">Note on Notifications</p>
                      {!reminderSupport.supported && <p className="mt-1 text-slate-500">Your browser does not support notifications.</p>}
                      {reminderSupport.reason && <p className="mt-1 text-slate-500">{reminderSupport.reason}</p>}
                      {!canConfigureReminderSettings && reminderSupport.supported && (
                        <p className="mt-1 text-slate-500">Please enable the toggle above and grant permission to configure reminders.</p>
                      )}
                    </div>
                  )}

                  <div className={\`space-y-4 transition-opacity \${!canConfigureReminderSettings ? 'opacity-50 pointer-events-none' : ''}\`}>
                    <div>
                      <p className={\`mb-2 text-[11px] font-semibold uppercase tracking-wider \${mutedText}\`}>Include in Reminders</p>
                      <div className="flex gap-3">
                        <label className={\`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition \${
                          reminders.includeDhikr ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                        }\`}>
                          <input
                            type="checkbox"
                            checked={reminders.includeDhikr}
                            onChange={(event) => handleReminderTypeToggle('includeDhikr', event.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium">Dhikr</span>
                        </label>
                        <label className={\`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition \${
                          reminders.includeDua ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                        }\`}>
                          <input
                            type="checkbox"
                            checked={reminders.includeDua}
                            onChange={(event) => handleReminderTypeToggle('includeDua', event.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium">Dua</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className={\`mb-2 text-[11px] font-semibold uppercase tracking-wider \${mutedText}\`}>Schedule Type</p>
                      <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => handleReminderScheduleTypeChange('periodic')}
                          className={\`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition \${
                            reminders.scheduleType === 'periodic'
                              ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }\`}
                        >
                          Periodic
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReminderScheduleTypeChange('specific')}
                          className={\`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition \${
                            reminders.scheduleType === 'specific'
                              ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }\`}
                        >
                          Specific Time
                        </button>
                      </div>
                    </div>

                    <div className={\`rounded-lg border p-3 \${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-white'}\`}>
                      {reminders.scheduleType === 'periodic' ? (
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">Frequency</span>
                          <select
                            value={reminders.periodicIntervalMinutes}
                            onChange={(event) => handleReminderIntervalChange(event.target.value)}
                            className={\`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 \${
                              isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                            }\`}
                          >
                            {REMINDER_INTERVAL_OPTIONS.map((minutes) => (
                              <option key={minutes} value={minutes}>
                                Every {minutes} min
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">Time of day</span>
                          <input
                            type="time"
                            value={reminders.specificTime}
                            onChange={(event) => handleReminderTimeChange(event.target.value)}
                            className={\`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 \${
                              isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                            }\`}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}`;

const mrStartIdx = content.indexOf(mobileReminderStartStr);
if (mrStartIdx !== -1) {
    const mrEndIdx = content.indexOf(mobileReminderEndStr, mrStartIdx) + mobileReminderEndStr.length;
    if (content.indexOf(mobileReminderEndStr, mrStartIdx) !== -1) {
        content = content.substring(0, mrStartIdx) + mobileReminderReplacement + content.substring(mrEndIdx);
        console.log("Mobile reminder replaced!");
    } else {
        console.log("Mobile reminder end not found");
    }
} else {
    console.log("Mobile reminder start not found");
}

fs.writeFileSync(file, content);
console.log("Done");
