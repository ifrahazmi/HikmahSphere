import React from 'react';
import { SpiritualFeature } from '../data/aboutContent';

interface FeatureShowcaseProps {
  features: SpiritualFeature[];
}

const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({ features }) => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            The Features: Tools for the Journey
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Every feature designed as a spiritual tool to support your Islamic practice
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const bgColorClass = feature.color ? feature.color.replace('text-', 'bg-') + '-50' : 'bg-emerald-50';
            const textColorClass = feature.color || 'text-emerald-600';

            return (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300"
              >
                <div className="relative">
                  <div className={`w-16 h-16 ${bgColorClass} rounded-lg flex items-center justify-center mb-6`}>
                    {typeof Icon === 'string' ? (
                      <span className="text-3xl">{Icon}</span>
                    ) : (
                      <Icon className={`w-8 h-8 ${textColorClass}`} />
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {feature.title}
                </h3>

                <p className="leading-relaxed text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;
