import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Users, ChevronLeft, Save, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Venue {
  id: string;
  name: string;
  locationDescription: string | null;
  locationLat: string | null;
  locationLng: string | null;
  contactDetails: string | null;
  description: string | null;
}

interface VenueStaff {
  id: string;
  venueId: string;
  name: string;
  idNumber: string | null;
  contactNumber: string | null;
  loginCode: string;
}

export default function ManageVenues() {
  const { toast } = useToast();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [editingVenue, setEditingVenue] = useState<Partial<Venue> | null>(null);
  const [showAddStaffDialog, setShowAddStaffDialog] = useState(false);
  const [showEditStaffDialog, setShowEditStaffDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<VenueStaff | null>(null);
  const [editingStaffPassword, setEditingStaffPassword] = useState("");
  const [newStaff, setNewStaff] = useState({ name: "", idNumber: "", contactNumber: "", password: "" });
  const [staffToDelete, setStaffToDelete] = useState<VenueStaff | null>(null);
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);

  const { data: venuesData, isLoading: venuesLoading } = useQuery<{ success: boolean; data: Venue[] }>({
    queryKey: ["/api/venues"],
  });

  const { data: venueStaffData, isLoading: staffLoading } = useQuery<{ success: boolean; data: { venue: Venue; staff: VenueStaff[] } }>({
    queryKey: ["/api/venues", selectedVenue?.id, "staff"],
    enabled: !!selectedVenue,
  });

  const updateVenueMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Venue> }) => {
      const response = await apiRequest("PUT", `/api/venues/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/venues", selectedVenue?.id, "staff"] });
      setEditingVenue(null);
      toast({ title: "Success", description: "Venue updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update venue", variant: "destructive" });
    },
  });

  const deleteVenueMutation = useMutation({
    mutationFn: async (venueId: string) => {
      const response = await apiRequest("DELETE", `/api/venues/${venueId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      setSelectedVenue(null);
      setVenueToDelete(null);
      toast({ title: "Success", description: "Venue deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete venue", variant: "destructive" });
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: async (data: { venueId: string; staff: typeof newStaff }) => {
      const response = await apiRequest("POST", `/api/venues/${data.venueId}/staff`, data.staff);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues", selectedVenue?.id, "staff"] });
      setShowAddStaffDialog(false);
      setNewStaff({ name: "", idNumber: "", contactNumber: "", password: "" });
      toast({ title: "Success", description: "Staff member added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add staff member", variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async (data: { staffId: string; updates: Partial<VenueStaff> & { password?: string } }) => {
      const response = await apiRequest("PUT", `/api/venue-staff/${data.staffId}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues", selectedVenue?.id, "staff"] });
      setShowEditStaffDialog(false);
      setEditingStaff(null);
      toast({ title: "Success", description: "Staff member updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update staff member", variant: "destructive" });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const response = await apiRequest("DELETE", `/api/venue-staff/${staffId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues", selectedVenue?.id, "staff"] });
      setStaffToDelete(null);
      toast({ title: "Success", description: "Staff member removed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove staff member", variant: "destructive" });
    },
  });

  const venues = venuesData?.data || [];
  const venueStaff = venueStaffData?.data?.staff || [];

  if (selectedVenue) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedVenue(null);
              setEditingVenue(null);
            }}
            className="mb-4"
            data-testid="button-back-to-venues"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Venues
          </Button>

          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle data-testid="text-venue-name">{selectedVenue.name}</CardTitle>
                <CardDescription>Venue Details</CardDescription>
              </div>
              <div className="flex gap-2">
                {editingVenue ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (editingVenue.id) {
                          updateVenueMutation.mutate({ id: editingVenue.id, updates: editingVenue });
                        }
                      }}
                      disabled={updateVenueMutation.isPending}
                      data-testid="button-save-venue"
                    >
                      {updateVenueMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingVenue(null)}
                      data-testid="button-cancel-edit-venue"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingVenue({ ...selectedVenue })}
                      data-testid="button-edit-venue"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setVenueToDelete(selectedVenue)}
                      data-testid="button-delete-venue"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingVenue ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Venue Name</Label>
                      <Input
                        value={editingVenue.name || ""}
                        onChange={(e) => setEditingVenue({ ...editingVenue, name: e.target.value })}
                        data-testid="input-edit-venue-name"
                      />
                    </div>
                    <div>
                      <Label>Location Description</Label>
                      <Input
                        value={editingVenue.locationDescription || ""}
                        onChange={(e) => setEditingVenue({ ...editingVenue, locationDescription: e.target.value })}
                        data-testid="input-edit-venue-location"
                      />
                    </div>
                    <div>
                      <Label>GPS Latitude</Label>
                      <Input
                        value={editingVenue.locationLat || ""}
                        onChange={(e) => setEditingVenue({ ...editingVenue, locationLat: e.target.value })}
                        data-testid="input-edit-venue-lat"
                      />
                    </div>
                    <div>
                      <Label>GPS Longitude</Label>
                      <Input
                        value={editingVenue.locationLng || ""}
                        onChange={(e) => setEditingVenue({ ...editingVenue, locationLng: e.target.value })}
                        data-testid="input-edit-venue-lng"
                      />
                    </div>
                    <div>
                      <Label>Contact Details</Label>
                      <Input
                        value={editingVenue.contactDetails || ""}
                        onChange={(e) => setEditingVenue({ ...editingVenue, contactDetails: e.target.value })}
                        data-testid="input-edit-venue-contact"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editingVenue.description || ""}
                      onChange={(e) => setEditingVenue({ ...editingVenue, description: e.target.value })}
                      data-testid="input-edit-venue-description"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground min-w-[120px]">Location:</span>
                    <span>{selectedVenue.locationDescription || "Not specified"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground min-w-[120px]">GPS:</span>
                    <span>{selectedVenue.locationLat && selectedVenue.locationLng ? `${selectedVenue.locationLat}, ${selectedVenue.locationLng}` : "Not specified"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground min-w-[120px]">Contact:</span>
                    <span>{selectedVenue.contactDetails || "Not specified"}</span>
                  </div>
                  {selectedVenue.description && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[120px]">Description:</span>
                      <span>{selectedVenue.description}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Staff Members
                </CardTitle>
                <CardDescription>Manage staff who can check in/out students at this venue</CardDescription>
              </div>
              <Button
                onClick={() => setShowAddStaffDialog(true)}
                data-testid="button-add-staff"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Staff
              </Button>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : venueStaff.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No staff members yet. Click "Add Staff" to add the first staff member.
                </div>
              ) : (
                <div className="space-y-3">
                  {venueStaff.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`staff-row-${staff.id}`}
                    >
                      <div>
                        <div className="font-medium" data-testid={`staff-name-${staff.id}`}>{staff.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {staff.idNumber && <span>ID: {staff.idNumber} • </span>}
                          {staff.contactNumber && <span>Phone: {staff.contactNumber}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingStaff(staff);
                            setEditingStaffPassword("");
                            setShowEditStaffDialog(true);
                          }}
                          data-testid={`button-edit-staff-${staff.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setStaffToDelete(staff)}
                          data-testid={`button-delete-staff-${staff.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={showAddStaffDialog} onOpenChange={setShowAddStaffDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>Add a new staff member to {selectedVenue.name}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="new-staff-name">Name *</Label>
                <Input
                  id="new-staff-name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  data-testid="input-new-staff-name"
                />
              </div>
              <div>
                <Label htmlFor="new-staff-id">ID Number</Label>
                <Input
                  id="new-staff-id"
                  value={newStaff.idNumber}
                  onChange={(e) => setNewStaff({ ...newStaff, idNumber: e.target.value })}
                  data-testid="input-new-staff-id"
                />
              </div>
              <div>
                <Label htmlFor="new-staff-phone">Contact Number</Label>
                <Input
                  id="new-staff-phone"
                  value={newStaff.contactNumber}
                  onChange={(e) => setNewStaff({ ...newStaff, contactNumber: e.target.value })}
                  data-testid="input-new-staff-phone"
                />
              </div>
              <div>
                <Label htmlFor="new-staff-password">Password *</Label>
                <Input
                  id="new-staff-password"
                  type="password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  data-testid="input-new-staff-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddStaffDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!newStaff.name || !newStaff.password) {
                    toast({ title: "Error", description: "Name and password are required", variant: "destructive" });
                    return;
                  }
                  addStaffMutation.mutate({ venueId: selectedVenue.id, staff: newStaff });
                }}
                disabled={addStaffMutation.isPending}
                data-testid="button-confirm-add-staff"
              >
                {addStaffMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Staff
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditStaffDialog} onOpenChange={setShowEditStaffDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
              <DialogDescription>Update staff member details</DialogDescription>
            </DialogHeader>
            {editingStaff && (
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="edit-staff-name">Name</Label>
                  <Input
                    id="edit-staff-name"
                    value={editingStaff.name}
                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    data-testid="input-edit-staff-name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-staff-id">ID Number</Label>
                  <Input
                    id="edit-staff-id"
                    value={editingStaff.idNumber || ""}
                    onChange={(e) => setEditingStaff({ ...editingStaff, idNumber: e.target.value })}
                    data-testid="input-edit-staff-id"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-staff-phone">Contact Number</Label>
                  <Input
                    id="edit-staff-phone"
                    value={editingStaff.contactNumber || ""}
                    onChange={(e) => setEditingStaff({ ...editingStaff, contactNumber: e.target.value })}
                    data-testid="input-edit-staff-phone"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-staff-password">New Password (leave blank to keep current)</Label>
                  <Input
                    id="edit-staff-password"
                    type="password"
                    placeholder="Enter new password"
                    value={editingStaffPassword}
                    onChange={(e) => setEditingStaffPassword(e.target.value)}
                    data-testid="input-edit-staff-password"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditStaffDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingStaff) {
                    const updates: any = {
                      name: editingStaff.name,
                      idNumber: editingStaff.idNumber,
                      contactNumber: editingStaff.contactNumber,
                    };
                    if (editingStaffPassword) {
                      updates.password = editingStaffPassword;
                    }
                    updateStaffMutation.mutate({ staffId: editingStaff.id, updates });
                  }
                }}
                disabled={updateStaffMutation.isPending}
                data-testid="button-confirm-edit-staff"
              >
                {updateStaffMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!staffToDelete} onOpenChange={() => setStaffToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {staffToDelete?.name} from this venue? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (staffToDelete) {
                    deleteStaffMutation.mutate(staffToDelete.id);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-staff"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!venueToDelete} onOpenChange={() => setVenueToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Venue</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {venueToDelete?.name}? This will also remove all staff members and scan history associated with this venue. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (venueToDelete) {
                    deleteVenueMutation.mutate(venueToDelete.id);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-venue"
              >
                Delete Venue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" data-testid="text-manage-venues-title">
            Manage Venues
          </h1>
          <Link href="/admin/register-venue">
            <Button data-testid="button-register-new-venue">
              <Plus className="w-4 h-4 mr-2" />
              Register New Venue
            </Button>
          </Link>
        </div>

        {venuesLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : venues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No venues registered yet.</p>
              <Link href="/admin/register-venue">
                <Button>Register Your First Venue</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {venues.map((venue) => (
              <Card
                key={venue.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedVenue(venue)}
                data-testid={`venue-card-${venue.id}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg" data-testid={`venue-name-${venue.id}`}>{venue.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {venue.locationDescription || "No location specified"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Users className="w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
