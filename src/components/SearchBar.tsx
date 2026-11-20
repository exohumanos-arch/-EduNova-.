import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  ariaLabel = 'Search',
}) => {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 text-[#85859B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] pl-10 pr-8 py-2 text-sm text-[#24243A] placeholder:text-[#85859B] focus:bg-white focus:border-[#7357E8] focus:outline-none focus:ring-2 focus:ring-[#7357E8]/20 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85859B] hover:text-[#24243A] p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
