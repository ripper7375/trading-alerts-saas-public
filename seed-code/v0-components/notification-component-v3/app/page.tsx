import NotificationBell from '@/components/notification-bell';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TradingAlerts
              </h1>
            </div>

            {/* Navigation Items */}
            <div className="flex items-center gap-6">
              <a
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/charts"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Charts
              </a>
              <a
                href="/pricing"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Pricing
              </a>

              {/* Notification Bell */}
              <NotificationBell />

              {/* User Avatar */}
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                JD
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Notification System Demo
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Click the bell icon in the top right to see the complete
              notification system with dynamic discount code reminders, alert
              notifications, and system messages.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {/* Feature 1 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white mb-4">
                🔔
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Real-Time Alerts
              </h3>
              <p className="text-gray-600">
                Get instant notifications when your price alerts trigger with
                detailed information.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white mb-4">
                💰
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Discount Reminders
              </h3>
              <p className="text-gray-600">
                Dynamic discount code reminders with system-configured
                percentages at 10, 7, and 3 days before renewal.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mb-4">
                ⚙️
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                System Messages
              </h3>
              <p className="text-gray-600">
                Stay updated with system announcements, new features, and
                important billing information.
              </p>
            </div>
          </div>

          {/* Notification Types */}
          <div className="mt-12 bg-gray-50 rounded-xl p-8 border-2 border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Notification Types
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  icon: '✓',
                  color: 'green',
                  title: 'Alert Triggered',
                  desc: 'Price reached your target',
                },
                {
                  icon: '⚠️',
                  color: 'orange',
                  title: 'Price Warning',
                  desc: 'Approaching alert level',
                },
                {
                  icon: 'ℹ️',
                  color: 'blue',
                  title: 'System Update',
                  desc: 'New features and changes',
                },
                {
                  icon: '⭐',
                  color: 'purple',
                  title: 'Upgrade Prompt',
                  desc: 'PRO features available',
                },
                {
                  icon: '🎫',
                  color: 'yellow',
                  title: 'Discount Reminder',
                  desc: 'Save on renewal with code',
                },
                {
                  icon: '⏰',
                  color: 'blue',
                  title: 'Billing Notice',
                  desc: 'Payment and subscription info',
                },
              ].map((type, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 bg-white rounded-lg p-4 border border-gray-200"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl bg-${type.color}-100`}
                  >
                    {type.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {type.title}
                    </h4>
                    <p className="text-sm text-gray-600">{type.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
            <h3 className="text-lg font-bold text-blue-900 mb-2">
              💡 Try It Out
            </h3>
            <ul className="space-y-2 text-blue-800">
              <li>• Click the bell icon to open the notification dropdown</li>
              <li>
                • Use tabs to filter by notification type (All, Alerts, System,
                Billing, Unread)
              </li>
              <li>
                • Click on notifications to mark them as read and navigate
              </li>
              <li>
                • Notice the dynamic discount percentages - these come from the
                SystemConfig, not hardcoded values
              </li>
              <li>
                • Urgent notifications (Day -3 reminders) have special styling
                and animations
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
