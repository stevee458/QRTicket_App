export default function Parent() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4" data-testid="text-parent-title">
          Parent Portal
        </h1>
        <p className="text-muted-foreground" data-testid="text-parent-description">
          Parent features will be implemented here.
        </p>
      </div>
    </div>
  );
}
