import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Admin() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" data-testid="text-admin-title">
          Admin Portal
        </h1>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/register">
            <a className="block">
              <div className="p-6 border rounded-lg hover-elevate">
                <h2 className="text-xl font-semibold mb-2">Register Students</h2>
                <p className="text-muted-foreground">
                  Register new parents and students, generate QR codes
                </p>
              </div>
            </a>
          </Link>
          
          <Link href="/admin/search">
            <a className="block">
              <div className="p-6 border rounded-lg hover-elevate">
                <h2 className="text-xl font-semibold mb-2">Search & Edit</h2>
                <p className="text-muted-foreground">
                  Search and edit parent and student records
                </p>
              </div>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
