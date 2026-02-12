export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 animate-pulse">
        {/* Logo/title skeleton */}
        <div className="text-center space-y-2">
          <div className="h-8 w-48 bg-gray-700 rounded mx-auto" />
          <div className="h-4 w-64 bg-gray-800 rounded mx-auto" />
        </div>

        {/* Form skeleton */}
        <div className="space-y-4">
          <div className="h-10 bg-gray-800 rounded border border-gray-700" />
          <div className="h-10 bg-gray-800 rounded border border-gray-700" />
          <div className="h-10 bg-gray-800 rounded" />
        </div>
      </div>
    </div>
  );
}
