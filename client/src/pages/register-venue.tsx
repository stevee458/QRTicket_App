import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InsertVenue } from "@shared/schema";

export default function RegisterVenue() {
  const { toast } = useToast();
  const [venueFormData, setVenueFormData] = useState<Partial<InsertVenue> & { staff?: Array<{ name: string; idNumber: string; contactNumber: string; password: string }> }>({});

  const createVenueMutation = useMutation({
    mutationFn: async (data: Partial<InsertVenue> & { staff?: Array<{ name: string; idNumber: string; contactNumber: string; password: string }> }) => {
      const venueResponse = await apiRequest("POST", "/api/venues", {
        name: data.name,
        locationDescription: data.locationDescription,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        contactDetails: data.contactDetails,
        description: data.description,
      });
      const venue = await venueResponse.json();
      
      if (data.staff && data.staff.length > 0) {
        for (const staffMember of data.staff) {
          await apiRequest("POST", `/api/venues/${venue.data.id}/staff`, staffMember);
        }
      }
      
      return venue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      setVenueFormData({});
      toast({
        title: "Success",
        description: "Venue created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create venue",
        variant: "destructive",
      });
    },
  });

  const handleCreateVenue = () => {
    if (!venueFormData.name) {
      toast({
        title: "Validation Error",
        description: "Please fill in the venue name",
        variant: "destructive",
      });
      return;
    }
    createVenueMutation.mutate(venueFormData);
  };

  const addStaffMember = () => {
    const currentStaff = venueFormData.staff || [];
    setVenueFormData({
      ...venueFormData,
      staff: [...currentStaff, { name: "", idNumber: "", contactNumber: "", password: "" }],
    });
  };

  const removeStaffMember = (index: number) => {
    const currentStaff = venueFormData.staff || [];
    setVenueFormData({
      ...venueFormData,
      staff: currentStaff.filter((_, i) => i !== index),
    });
  };

  const updateStaffMember = (index: number, field: "name" | "idNumber" | "contactNumber" | "password", value: string) => {
    const currentStaff = venueFormData.staff || [];
    const updatedStaff = currentStaff.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    setVenueFormData({ ...venueFormData, staff: updatedStaff });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" data-testid="text-register-venue-title">
          Register Venue
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Venue Registration</CardTitle>
            <CardDescription>
              Add venues (schools, activity centers, etc.) for student check-in/check-out tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="venue-name">Venue Name *</Label>
                  <Input
                    id="venue-name"
                    value={venueFormData.name || ""}
                    onChange={(e) => setVenueFormData({ ...venueFormData, name: e.target.value })}
                    data-testid="input-venue-name"
                  />
                </div>
                <div>
                  <Label htmlFor="venue-location-description">Location Description</Label>
                  <Input
                    id="venue-location-description"
                    value={venueFormData.locationDescription || ""}
                    onChange={(e) => setVenueFormData({ ...venueFormData, locationDescription: e.target.value })}
                    data-testid="input-venue-location-description"
                  />
                </div>
                <div>
                  <Label htmlFor="venue-gps-lat">GPS Latitude</Label>
                  <Input
                    id="venue-gps-lat"
                    value={venueFormData.locationLat || ""}
                    onChange={(e) => setVenueFormData({ ...venueFormData, locationLat: e.target.value })}
                    data-testid="input-venue-gps-lat"
                  />
                </div>
                <div>
                  <Label htmlFor="venue-gps-lng">GPS Longitude</Label>
                  <Input
                    id="venue-gps-lng"
                    value={venueFormData.locationLng || ""}
                    onChange={(e) => setVenueFormData({ ...venueFormData, locationLng: e.target.value })}
                    data-testid="input-venue-gps-lng"
                  />
                </div>
                <div>
                  <Label htmlFor="venue-contact-details">Contact Details</Label>
                  <Input
                    id="venue-contact-details"
                    value={venueFormData.contactDetails || ""}
                    onChange={(e) => setVenueFormData({ ...venueFormData, contactDetails: e.target.value })}
                    data-testid="input-venue-contact-details"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="venue-description">Description</Label>
                <Textarea
                  id="venue-description"
                  value={venueFormData.description || ""}
                  onChange={(e) => setVenueFormData({ ...venueFormData, description: e.target.value })}
                  data-testid="input-venue-description"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Staff Members</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStaffMember}
                    data-testid="button-add-staff-member"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Staff Member
                  </Button>
                </div>
                {venueFormData.staff?.map((staff, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Staff Member {index + 1}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeStaffMember(index)}
                        data-testid={`button-remove-staff-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor={`staff-name-${index}`}>Name *</Label>
                        <Input
                          id={`staff-name-${index}`}
                          value={staff.name}
                          onChange={(e) => updateStaffMember(index, "name", e.target.value)}
                          data-testid={`input-staff-name-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`staff-id-number-${index}`}>ID Number</Label>
                        <Input
                          id={`staff-id-number-${index}`}
                          value={staff.idNumber}
                          onChange={(e) => updateStaffMember(index, "idNumber", e.target.value)}
                          data-testid={`input-staff-id-number-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`staff-contact-${index}`}>Contact Number</Label>
                        <Input
                          id={`staff-contact-${index}`}
                          value={staff.contactNumber}
                          onChange={(e) => updateStaffMember(index, "contactNumber", e.target.value)}
                          data-testid={`input-staff-contact-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`staff-password-${index}`}>Password *</Label>
                        <Input
                          id={`staff-password-${index}`}
                          type="password"
                          value={staff.password}
                          onChange={(e) => updateStaffMember(index, "password", e.target.value)}
                          data-testid={`input-staff-password-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                onClick={handleCreateVenue} 
                disabled={createVenueMutation.isPending}
                data-testid="button-create-venue"
              >
                {createVenueMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Venue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
