import React, { useRef, useState, useEffect } from 'react';
import CountUp from 'react-countup';
import { ChartBarIcon, UserGroupIcon, GlobeAltIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface Statistic {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
}

const statistics: Statistic[] = [
  {
    label: 'Active Users',
    value: 25000,
    suffix: '+',
    description: 'Muslims worldwide',
    icon: UserGroupIcon,
    color: 'text-emerald-600'
  },
  {
    label: 'Countries Reached',
    value: 150,
    suffix: '+',
    description: 'Global presence',
    icon: GlobeAltIcon,
    color: 'text-blue-600'
  },
  {
    label: 'Prayers Calculated',
    value: 50000,
    suffix: '+',
    description: 'Daily calculations',
    icon: ChartBarIcon,
    color: 'text-teal-600'
  },
  {
    label: 'Zakat Managed',
    value: 800000,
    suffix: '+',
    prefix: '₹',
    description: 'Annual impact',
    icon: CurrencyDollarIcon,
    color: 'text-purple-600'
  }
];

interface CountUpStatProps {
  stat: Statistic;
  shouldStart: boolean;
}

const CountUpStat: React.FC<CountUpStatProps> = ({ stat, shouldStart }) => {
  const Icon = stat.icon;

  return (
    <div className="text-center p-6 sm:p-8">
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-lg bg-${stat.color.split('-')[1]}-50 mb-4`}>
        <Icon className={`w-8 h-8 ${stat.color}`} />
      </div>
      <div className="text-3xl lg:text-4xl font-bold text-emerald-600 mb-2">
        {stat.prefix && <span>{stat.prefix}</span>}
        {shouldStart ? (
          <CountUp end={stat.value} duration={5} separator="," />
        ) : (
          <span>0</span>
        )}
        {stat.suffix && <span>{stat.suffix}</span>}
      </div>
      <div className="text-lg font-semibold text-gray-900 mb-1">
        {stat.label}
      </div>
      <div className="text-sm text-gray-600">
        {stat.description}
      </div>
    </div>
  );
};

const LiveStatistics: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [shouldStart, setShouldStart] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !shouldStart) {
          setShouldStart(true);
          observer.unobserve(sectionRef.current!);
        }
      },
      { threshold: 0.3 }
    );

    const section = sectionRef.current;
    if (section) {
      observer.observe(section);
    }

    return () => {
      if (section) {
        observer.unobserve(section);
      }
    };
  }, [shouldStart]);

  return (
    <section ref={sectionRef} className="py-16 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Growing Community Impact
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real numbers reflecting our collective journey toward accessible Islamic knowledge
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {statistics.map((stat, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-8 shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 border border-emerald-100"
            >
              <CountUpStat stat={stat} shouldStart={shouldStart} />
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 italic">
            These numbers represent the real-world impact of Muslims united in pursuit of authentic knowledge.
          </p>
        </div>
      </div>
    </section>
  );
};

export default LiveStatistics;
