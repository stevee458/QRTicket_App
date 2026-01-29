import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InsertVehicle, InsertShift, InsertDriver } from "@shared/schema";

export default function RegisterTransport() {
  const { toast } = useToast();
  const [transportTab, setTransportTab] = useState<"vehicle" | "shift" | "driver">("vehicle");
  const [vehicleFormData, setVehicleFormData] = useState<Partial<InsertVehicle>>({});
  const [shiftFormData, setShiftFormData] = useState<Partial<InsertShift>>({});
  const [driverFormData, setDriverFormData] = useState<Partial<InsertDriver>>({});

  const createVehicleMutation = useMutation({
    mutationFn: async (data: Partial<InsertVehicle>) => {
      const response = await apiRequest("POST", "/api/vehicles", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/vehicles"] });
      setVehicleFormData({});
      toast({
        title: "Success",
        description: "Vehicle created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create vehicle",
        variant: "destructive",
      });
    },
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data: Partial<InsertShift>) => {
      const response = await apiRequest("POST", "/api/shifts", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/shifts"] });
      setShiftFormData({});
      toast({
        title: "Success",
        description: "Shift created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create shift",
        variant: "destructive",
      });
    },
  });

  const createDriverMutation = useMutation({
    mutationFn: async (data: Partial<InsertDriver>) => {
      const response = await apiRequest("POST", "/api/drivers", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/drivers"] });
      setDriverFormData({});
      toast({
        title: "Success",
        description: "Driver created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create driver",
        variant: "destructive",
      });
    },
  });

  const handleCreateVehicle = () => {
    if (!vehicleFormData.busNumber || !vehicleFormData.registrationNumber || !vehicleFormData.depotName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all vehicle fields",
        variant: "destructive",
      });
      return;
    }
    createVehicleMutation.mutate(vehicleFormData);
  };

  const handleCreateShift = () => {
    if (!shiftFormData.shiftNumber || !shiftFormData.shiftTitle || !shiftFormData.shiftDescription) {
      toast({
        title: "Validation Error",
        description: "Please fill in all shift fields",
        variant: "destructive",
      });
      return;
    }
    createShiftMutation.mutate(shiftFormData);
  };

  const handleCreateDriver = () => {
    if (!driverFormData.companyNumber || !driverFormData.driverName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all driver fields",
        variant: "destructive",
      });
      return;
    }
    createDriverMutation.mutate(driverFormData);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" data-testid="text-register-transport-title">
          Register Transport
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Transport Registration</CardTitle>
            <CardDescription>
              Add vehicles, shifts, or drivers to the transport system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={transportTab} onValueChange={(v) => setTransportTab(v as "vehicle" | "shift" | "driver")}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="vehicle" data-testid="tab-vehicle">Vehicle</TabsTrigger>
                <TabsTrigger value="shift" data-testid="tab-shift">Shift</TabsTrigger>
                <TabsTrigger value="driver" data-testid="tab-driver">Driver</TabsTrigger>
              </TabsList>

              <TabsContent value="vehicle" className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="bus-number">Bus Number *</Label>
                      <Input
                        id="bus-number"
                        value={vehicleFormData.busNumber || ""}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, busNumber: e.target.value })}
                        data-testid="input-bus-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="registration-number">Registration Number *</Label>
                      <Input
                        id="registration-number"
                        value={vehicleFormData.registrationNumber || ""}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, registrationNumber: e.target.value })}
                        data-testid="input-registration-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="depot-name">Depot Name *</Label>
                      <Input
                        id="depot-name"
                        value={vehicleFormData.depotName || ""}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, depotName: e.target.value })}
                        data-testid="input-depot-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vehicle-make">Make</Label>
                      <Input
                        id="vehicle-make"
                        value={vehicleFormData.make || ""}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, make: e.target.value })}
                        data-testid="input-vehicle-make"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vehicle-model">Model</Label>
                      <Input
                        id="vehicle-model"
                        value={vehicleFormData.model || ""}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, model: e.target.value })}
                        data-testid="input-vehicle-model"
                      />
                    </div>
                    <div>
                      <Label htmlFor="license-expiry">License Expiry Date</Label>
                      <Input
                        id="license-expiry"
                        type="date"
                        value={vehicleFormData.licenseExpiryDate || ""}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, licenseExpiryDate: e.target.value })}
                        data-testid="input-license-expiry"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    * Required fields. You can add license disk images and documents after creating the vehicle via Search & Edit.
                  </p>
                  <Button 
                    onClick={handleCreateVehicle} 
                    disabled={createVehicleMutation.isPending}
                    data-testid="button-create-vehicle"
                  >
                    {createVehicleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Vehicle
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="shift" className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="shift-number">Shift Number</Label>
                    <Input
                      id="shift-number"
                      value={shiftFormData.shiftNumber || ""}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, shiftNumber: e.target.value })}
                      data-testid="input-shift-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shift-title">Shift Title</Label>
                    <Input
                      id="shift-title"
                      value={shiftFormData.shiftTitle || ""}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, shiftTitle: e.target.value })}
                      data-testid="input-shift-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shift-description">Shift Description</Label>
                    <Textarea
                      id="shift-description"
                      value={shiftFormData.shiftDescription || ""}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, shiftDescription: e.target.value })}
                      data-testid="input-shift-description"
                    />
                  </div>
                  <Button 
                    onClick={handleCreateShift} 
                    disabled={createShiftMutation.isPending}
                    data-testid="button-create-shift"
                  >
                    {createShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Shift
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="driver" className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="company-number">Company Number *</Label>
                      <Input
                        id="company-number"
                        value={driverFormData.companyNumber || ""}
                        onChange={(e) => setDriverFormData({ ...driverFormData, companyNumber: e.target.value })}
                        data-testid="input-company-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="driver-name">Driver Name *</Label>
                      <Input
                        id="driver-name"
                        value={driverFormData.driverName || ""}
                        onChange={(e) => setDriverFormData({ ...driverFormData, driverName: e.target.value })}
                        data-testid="input-driver-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="driver-id-number">ID Number</Label>
                      <Input
                        id="driver-id-number"
                        value={driverFormData.idNumber || ""}
                        onChange={(e) => setDriverFormData({ ...driverFormData, idNumber: e.target.value })}
                        data-testid="input-driver-id-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="driver-contact">Contact Number</Label>
                      <Input
                        id="driver-contact"
                        value={driverFormData.contactNumber || ""}
                        onChange={(e) => setDriverFormData({ ...driverFormData, contactNumber: e.target.value })}
                        data-testid="input-driver-contact"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    * Required fields. You can add ID copy, driver's license, and PDP images after creating the driver via Search & Edit.
                  </p>
                  <Button 
                    onClick={handleCreateDriver} 
                    disabled={createDriverMutation.isPending}
                    data-testid="button-create-driver"
                  >
                    {createDriverMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Driver
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
