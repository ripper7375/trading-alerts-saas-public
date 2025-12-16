'use client';

import { useState } from 'react';
import CreateAlertModal from '@/components/create-alert-modal';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userTier, setUserTier] = useState<'FREE' | 'PRO'>('FREE');
  const [currentAlertCount, setCurrentAlertCount] = useState(4);

  const prefilledData = {
    symbol: 'XAUUSD',
    timeframe: 'H1',
    targetLine: 'b-b1', // Pre-selected green support line
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-center text-4xl font-bold text-gray-900">
          Alert Modal Demo
        </h1>

        <div className="mb-8 space-y-4 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <h2 className="text-xl font-semibold text-gray-800">Demo Settings</h2>

          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700">User Tier:</label>
            <div className="flex gap-2">
              <Button
                variant={userTier === 'FREE' ? 'default' : 'outline'}
                onClick={() => setUserTier('FREE')}
              >
                FREE
              </Button>
              <Button
                variant={userTier === 'PRO' ? 'default' : 'outline'}
                onClick={() => setUserTier('PRO')}
              >
                PRO
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700">Current Alerts:</label>
            <input
              type="number"
              value={currentAlertCount}
              onChange={(e) =>
                setCurrentAlertCount(Number.parseInt(e.target.value) || 0)
              }
              min={0}
              max={userTier === 'FREE' ? 5 : 20}
              className="w-20 rounded-lg border-2 border-gray-300 px-3 py-2"
            />
            <span className="text-gray-600">
              / {userTier === 'FREE' ? 5 : 20}
            </span>
          </div>

          <div className="mt-4 rounded-lg bg-blue-50 p-4">
            <h3 className="mb-2 font-semibold text-blue-900">
              Prefilled Data:
            </h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Symbol: {prefilledData.symbol}</li>
              <li>• Timeframe: {prefilledData.timeframe}</li>
              <li>• Target Line: B-B1 (Support at $2,645.00)</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={() => setIsModalOpen(true)}
            size="lg"
            className="bg-blue-600 px-8 py-6 text-lg font-semibold shadow-lg hover:bg-blue-700"
          >
            🔔 Open Create Alert Modal
          </Button>
        </div>

        <div className="mt-8 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <h3 className="mb-3 font-semibold text-gray-800">
            Features Included:
          </h3>
          <ul className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
            <li>✅ Locked symbol & timeframe fields</li>
            <li>✅ Three alert type options with radio buttons</li>
            <li>✅ Target line dropdown with visual indicators</li>
            <li>✅ Dynamic tolerance slider (0.05% - 1.00%)</li>
            <li>✅ Price range preview calculation</li>
            <li>✅ Multiple notification methods</li>
            <li>✅ SMS locked for FREE users</li>
            <li>✅ Tier-based alert limit validation</li>
            <li>✅ React Hook Form + Zod validation</li>
            <li>✅ Success animation with auto-close</li>
            <li>✅ Error handling for tier limits</li>
            <li>✅ ESC key & click outside to close</li>
            <li>✅ Fully responsive design</li>
            <li>✅ Loading states & animations</li>
          </ul>
        </div>
      </div>

      <CreateAlertModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        prefilledData={prefilledData}
        userTier={userTier}
        currentAlertCount={currentAlertCount}
      />
    </main>
  );
}
