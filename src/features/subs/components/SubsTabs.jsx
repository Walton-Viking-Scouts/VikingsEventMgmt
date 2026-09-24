import React from 'react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/subs', label: 'Summary', end: true },
  { to: '/subs/leaders-children', label: 'Leaders\' children', end: false },
];

/**
 * Tabs switching between the Subs views.
 *
 * @returns {JSX.Element} The Subs sub-navigation
 */
function SubsTabs() {
  return (
    <nav aria-label="Subs views" className="mb-4 flex gap-6 border-b border-gray-200">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `-mb-px border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
            isActive
              ? 'border-scout-blue text-scout-blue'
              : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default SubsTabs;
