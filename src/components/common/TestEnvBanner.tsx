// Always-visible marker that the app is running against the dedicated test
// Supabase project (npm run dev:e2e / build:e2e). Renders nothing in any other
// mode. The project ref is derived from the env URL rather than hardcoded so
// the production bundle never contains the test project ref.
const TestEnvBanner = () => {
  if (import.meta.env.MODE !== 'test') return null;
  const ref = String(import.meta.env.VITE_SUPABASE_URL || '')
    .replace('https://', '')
    .split('.')[0];
  return (
    <div
      dir="ltr"
      className="fixed top-0 inset-x-0 z-[100] bg-yellow-400 text-black text-xs font-bold text-center py-0.5 pointer-events-none"
    >
      🧪 TEST ENV — {ref}
    </div>
  );
};

export default TestEnvBanner;
