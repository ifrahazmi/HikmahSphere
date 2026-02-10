import React from 'react';
import { TimelinePhase } from '../data/aboutContent';

interface TimelineProps {
  phases: TimelinePhase[];
}

const Timeline: React.FC<TimelineProps> = ({ phases }) => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            What We're Building
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From our current foundation to a comprehensive Islamic digital ecosystem
          </p>
        </div>

        {/* Desktop Timeline - Horizontal */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400"></div>

            {/* Timeline Cards */}
            <div className="grid grid-cols-3 gap-6 relative z-10">
              {phases.map((phase, index) => {
                const Icon = phase.icon;
                return (
                  <div key={index} className="flex flex-col items-center">
                    {/* Circle Node */}
                    <div className="w-12 h-12 bg-white border-4 border-emerald-600 rounded-full flex items-center justify-center mb-8 shadow-lg">
                      <Icon className="w-6 h-6 text-emerald-600" />
                    </div>

                    {/* Card */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-8 border border-emerald-100 w-full shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {phase.title}
                        </h3>
                        <p className="text-emerald-600 font-semibold mb-4">
                          {phase.period}
                        </p>
                        <p className="text-gray-700 mb-6 leading-relaxed">
                          {phase.description}
                        </p>

                        <div className="space-y-2">
                          {phase.features?.map((feature, featureIndex) => (
                            <div
                              key={featureIndex}
                              className="flex items-start gap-2 text-sm text-gray-600"
                            >
                              <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile Timeline - Vertical */}
        <div className="lg:hidden space-y-8">
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            return (
              <div key={index} className="relative">
                {/* Vertical Line */}
                {index < phases.length - 1 && (
                  <div className="absolute left-6 top-20 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-400"></div>
                )}

                {/* Node and Card */}
                <div className="flex gap-4">
                  {/* Circle Node */}
                  <div className="w-12 h-12 bg-white border-4 border-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg relative z-10">
                    <Icon className="w-6 h-6 text-emerald-600" />
                  </div>

                  {/* Card */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100 w-full shadow-lg flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {phase.title}
                    </h3>
                    <p className="text-emerald-600 font-semibold mb-3">
                      {phase.period}
                    </p>
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {phase.description}
                    </p>

                    <div className="space-y-2">
                      {phase.features?.map((feature, featureIndex) => (
                        <div
                          key={featureIndex}
                          className="flex items-start gap-2 text-sm text-gray-600"
                        >
                          <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Timeline;
