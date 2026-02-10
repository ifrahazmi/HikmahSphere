import React from 'react';
import { Pillar } from '../data/aboutContent';

interface MissionPillarsProps {
  pillars: Pillar[];
  title?: string;
  description?: string;
}

const MissionPillars: React.FC<MissionPillarsProps> = ({
  pillars,
  title = 'Our Three Pillars',
  description = ''
}) => {
  return (
    <section className="py-20 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {title && (
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {title}
            </h2>
            {description && (
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pillars.map((pillar, index) => {
            return (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 border border-emerald-100"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">{pillar.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      {pillar.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {pillar.description}
                    </p>
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

export default MissionPillars;
