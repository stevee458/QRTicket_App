import { Link } from "wouter";

export default function Admin() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" data-testid="text-admin-title">
          Admin Portal
        </h1>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/register">
            <div className="p-6 border rounded-lg hover-elevate cursor-pointer">
              <h2 className="text-xl font-semibold mb-2">Register Students</h2>
              <p className="text-muted-foreground">
                Register new parents and students, generate QR codes
              </p>
            </div>
          </Link>

          <Link href="/admin/register-transport">
            <div className="p-6 border rounded-lg hover-elevate cursor-pointer">
              <h2 className="text-xl font-semibold mb-2">Register Transport</h2>
              <p className="text-muted-foreground">
                Register vehicles, shifts, and drivers for transport management
              </p>
            </div>
          </Link>
          
          <Link href="/admin/search">
            <div className="p-6 border rounded-lg hover-elevate cursor-pointer">
              <h2 className="text-xl font-semibold mb-2">Search & Edit</h2>
              <p className="text-muted-foreground">
                Search and edit all records (parents, students, transport)
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
