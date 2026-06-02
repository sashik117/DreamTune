export default function AppLoadingScreen({ visible }) {
  return (
    <div className="fixed inset-0 bg-background px-6" aria-busy="true">
      {visible && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-[260px] text-center">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
            <p className="text-sm font-semibold text-foreground">DreamTune is loading...</p>
          </div>
        </div>
      )}
    </div>
  );
}
