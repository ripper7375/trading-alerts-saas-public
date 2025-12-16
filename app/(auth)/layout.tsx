export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Trading Alerts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to our secure trading platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
