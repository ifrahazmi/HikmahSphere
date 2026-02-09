import React from 'react';
import { HeartIcon } from '@heroicons/react/24/solid';
import { Link } from 'react-router-dom';
import logo from '../logo-bgremov.png';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <img src={logo} alt="HikmahSphere Logo" className="w-48 h-48 object-contain" />
              </div>
              <span className="ml-3 text-xl font-bold text-emerald-400">HikmahSphere</span>
            </div>
            <p className="text-gray-400 max-w-sm">
              It represents a digital space where Islamic knowledge, technology and spiritual guidance come together in one unified world.
            </p>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4">Platform</h3>
            <ul className="space-y-3">
              <li><Link to="/prayers" className="text-gray-300 hover:text-emerald-400">Prayer Times</Link></li>
              <li><Link to="/quran" className="text-gray-300 hover:text-emerald-400">Quran Reader</Link></li>
              <li><Link to="/zakat" className="text-gray-300 hover:text-emerald-400">Zakat Center</Link></li>
              <li><Link to="/community" className="text-gray-300 hover:text-emerald-400">Community</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4">Connect</h3>
            <ul className="space-y-3">
              <li><a href="https://discord.gg/hikmahsphere" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-emerald-400">Discord</a></li>
              <li><a href="https://twitter.com/HikmahSphere" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-emerald-400">Twitter</a></li>
              <li><a href="https://github.com/yani2298/HikmahSphere" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-emerald-400">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 text-gray-300 mb-4 md:mb-0">
              <span>Made with</span>
              <HeartIcon className="h-5 w-5 text-emerald-500" />
              <span>for the Ummah worldwide © By Ifrah Azmi</span>
            </div>
            
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">© {currentYear} HikmahSphere. All rights reserved.</p>
              <p className="text-gray-500 text-xs mt-1 font-scheherazade">"وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا"</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
