const fs = require('fs');
const file = 'src/pages/DhikrDua.tsx';
let content = fs.readFileSync(file, 'utf8');

const desktopReminderStartStr = `                    <div className={\`rounded-xl border p-4 \${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-white'}\`}>
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">`;
const desktopReminderEndStr = `                          </label>
                        )}

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
fs.writeFileSync(file, content);
console.log("Done");
