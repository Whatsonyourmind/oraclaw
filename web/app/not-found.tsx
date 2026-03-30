import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-mono font-bold text-claw-500 mb-4">404</h1>
      <p className="text-gray-400 mb-8">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 bg-claw-500 text-black font-mono font-semibold rounded-lg hover:bg-claw-400 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
