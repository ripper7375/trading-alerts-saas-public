'use client';

import { X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'symbol' | 'timeframe';
  itemName: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  itemType,
  itemName,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  const handleStartTrial = () => {
    alert('Free trial started! (This is a demo)');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative max-w-md w-full mx-4 bg-white rounded-2xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Icon */}
        <div className="text-6xl mb-4">🔒</div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Upgrade to PRO
        </h2>

        {/* Message */}
        <p className="text-gray-700 mb-2">
          <span className="font-semibold">{itemName}</span> is available in PRO
          tier
        </p>
        <p className="text-gray-600 mb-6">
          Get access to 15 symbols and 9 timeframes with PRO
        </p>

        {/* Benefits List */}
        <div className="text-left space-y-2 mb-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="text-green-600 text-lg">✅</span>
            <span className="text-sm text-gray-700">
              15 Trading Symbols (vs 5 on FREE)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 text-lg">✅</span>
            <span className="text-sm text-gray-700">
              9 Timeframes M5-D1 (vs 3 on FREE)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 text-lg">✅</span>
            <span className="text-sm text-gray-700">
              20 Alerts (vs 5 on FREE)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 text-lg">✅</span>
            <span className="text-sm text-gray-700">
              Priority Updates (30s vs 60s)
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="text-4xl font-bold text-gray-900 mb-1">$29/month</div>
          <div className="text-sm text-green-600 font-semibold">
            7-day free trial
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={handleStartTrial}
          className="w-full bg-blue-600 text-white px-8 py-3 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors mb-3"
        >
          Start Free Trial
        </button>
        <button
          onClick={onClose}
          className="text-gray-600 hover:underline text-sm"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
