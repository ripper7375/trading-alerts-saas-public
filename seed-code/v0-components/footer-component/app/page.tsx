import MarketingFooter from '@/components/marketing-footer';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Demo content to showcase the footer */}
      <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="mb-4 text-5xl font-bold text-gray-900">
            Marketing Footer Component
          </h1>
          <p className="text-lg text-gray-600">
            Scroll down to see the comprehensive footer
          </p>
        </div>
      </div>

      {/* Marketing Footer */}
      <MarketingFooter />
    </main>
  );
}
