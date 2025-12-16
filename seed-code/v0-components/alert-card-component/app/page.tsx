import { AlertCardDemo } from '@/components/alert-card';

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 px-8">
          Trading Alerts
        </h1>
        <AlertCardDemo />
      </div>
    </main>
  );
}
