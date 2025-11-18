import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogOut, Users, WifiOff, Wifi, RefreshCw, Camera, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Driver {
  id: string;
  driverName: string;
  companyNumber: string;
}

interface Vehicle {
  id: string;
  busNumber: string;
  registrationNumber: string;
  depotName: string;
}

interface Shift {
  id: string;
  shiftNumber: string;
  shiftTitle: string;
  shiftDescription: string;
}

interface StudentWithStatus {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number;
  school: string;
  status?: string;
}

interface PendingScan {
  studentId: string;
  scanType: "On" | "Off";
  location: string;
  forced: boolean;
  scannedAt: string;
  qrData: string;
}

interface DriverSession {
  driver: Driver;
  vehicle: Vehicle;
  shift: Shift;
}

export default function DriverPage() {
  const { toast } = useToast();
  
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  
  // Session state
  const [session, setSession] = useState<DriverSession | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState("");
  
  // Scanning state
  const [scanMode, setScanMode] = useState<"Board" | "Alight" | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrInput, setQrInput] = useState("");
  const [showOnboardList, setShowOnboardList] = useState(false);
  
  // Offline sync state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved session from localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem("driverSession");
    const savedPendingScans = localStorage.getItem("pendingScans");
    
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed);
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Error loading session:", error);
        localStorage.removeItem("driverSession");
      }
    }
    
    if (savedPendingScans) {
      try {
        setPendingScans(JSON.parse(savedPendingScans));
      } catch (error) {
        console.error("Error loading pending scans:", error);
        localStorage.removeItem("pendingScans");
      }
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-sync logic
  useEffect(() => {
    if (isOnline && pendingScans.length > 0 && !isSyncing) {
      // Clear existing timers
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      if (periodicSyncRef.current) {
        clearInterval(periodicSyncRef.current);
      }
      
      // Start periodic sync every 3 minutes
      periodicSyncRef.current = setInterval(() => {
        syncPendingScans();
      }, 3 * 60 * 1000);
    }
    
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      if (periodicSyncRef.current) {
        clearInterval(periodicSyncRef.current);
      }
    };
  }, [isOnline, pendingScans.length, isSyncing]);

  const [loggedInDriver, setLoggedInDriver] = useState<Driver | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { driverName: string; companyNumber: string }) => {
      const response = await apiRequest("POST", "/api/driver/login", credentials);
      return await response.json();
    },
    onSuccess: (data: { success: boolean; data: Driver }) => {
      // Store credentials locally for offline login
      localStorage.setItem("driverCredentials", JSON.stringify({ driverName, companyNumber }));
      setLoggedInDriver(data.data);
      toast({
        title: "Login Successful",
        description: `Welcome, ${data.data.driverName}!`,
      });
      setIsLoggedIn(true);
    },
    onError: async () => {
      // Try offline login
      const savedCredentials = localStorage.getItem("driverCredentials");
      if (savedCredentials) {
        try {
          const parsed = JSON.parse(savedCredentials);
          if (parsed.driverName === driverName && parsed.companyNumber === companyNumber) {
            toast({
              title: "Offline Login",
              description: "Logged in using saved credentials (offline mode)",
            });
            setIsLoggedIn(true);
            return;
          }
        } catch (error) {
          console.error("Offline login error:", error);
        }
      }
      
      toast({
        title: "Login Failed",
        description: "Invalid credentials or no saved credentials for offline login",
        variant: "destructive",
      });
    },
  });

  const { data: vehiclesData } = useQuery<{ success: boolean; data: Vehicle[] }>({
    queryKey: ["/api/driver/vehicles"],
    enabled: isLoggedIn && !session,
  });

  const { data: shiftsData } = useQuery<{ success: boolean; data: Shift[] }>({
    queryKey: ["/api/driver/shifts"],
    enabled: isLoggedIn && !session,
  });

  const { data: onboardData, refetch: refetchOnboard } = useQuery<{ success: boolean; data: StudentWithStatus[] }>({
    queryKey: ["/api/driver/onboard", session?.driver.id, session?.vehicle.id, session?.shift.id],
    enabled: !!session,
    refetchInterval: 30000,
  });

  const handleLogin = () => {
    if (!driverName || !companyNumber) {
      toast({
        title: "Validation Error",
        description: "Please enter both driver name and company number",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ driverName, companyNumber });
  };

  const handleStartShift = () => {
    if (!selectedVehicleId || !selectedShiftId) {
      toast({
        title: "Validation Error",
        description: "Please select both vehicle and shift",
        variant: "destructive",
      });
      return;
    }

    const vehicles = vehiclesData?.data || [];
    const shifts = shiftsData?.data || [];
    
    const vehicle = vehicles.find((v: Vehicle) => v.id === selectedVehicleId);
    const shift = shifts.find((s: Shift) => s.id === selectedShiftId);
    
    if (!vehicle || !shift) {
      toast({
        title: "Error",
        description: "Selected vehicle or shift not found",
        variant: "destructive",
      });
      return;
    }

    const newSession: DriverSession = {
      driver: loggedInDriver || {
        id: "",
        driverName,
        companyNumber,
      },
      vehicle,
      shift,
    };

    setSession(newSession);
    localStorage.setItem("driverSession", JSON.stringify(newSession));
    
    toast({
      title: "Shift Started",
      description: `Bus ${vehicle.busNumber} - ${shift.shiftTitle}`,
    });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSession(null);
    setDriverName("");
    setCompanyNumber("");
    localStorage.removeItem("driverSession");
    
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
  };

  const handleScanButtonClick = (mode: "Board" | "Alight") => {
    setScanMode(mode);
    setShowQRScanner(true);
    setQrInput("");
  };

  const handleQRScan = async () => {
    if (!qrInput || !session) return;

    try {
      const parsedQR = JSON.parse(qrInput);
      const studentId = parsedQR.studentId;
      const studentName = parsedQR.name || "Student";
      const message = scanMode === "Board" ? `Hi ${studentName.split(' ')[0]}` : `Goodbye ${studentName.split(' ')[0]}`;

      // Check current status
      const onboardList = onboardData?.data || [];
      const isCurrentlyOnboard = onboardList.some(s => s.id === studentId);

      // Validate scan action
      if (scanMode === "Board" && isCurrentlyOnboard) {
        toast({
          title: "Warning",
          description: `${studentName} is already on board`,
          variant: "destructive",
        });
        return;
      }

      if (scanMode === "Alight" && !isCurrentlyOnboard) {
        toast({
          title: "Warning",
          description: `${studentName} is not currently on board`,
          variant: "destructive",
        });
        return;
      }

      // Create scan record
      const scan: PendingScan = {
        studentId,
        scanType: scanMode === "Board" ? "On" : "Off",
        location: "GPS: Placeholder", // TODO: Get actual GPS
        forced: false,
        scannedAt: new Date().toISOString(),
        qrData: qrInput,
      };

      if (isOnline) {
        // Try to submit immediately
        try {
          await apiRequest("POST", "/api/driver/scan", {
            studentId,
            driverId: session.driver.id,
            vehicleId: session.vehicle.id,
            shiftId: session.shift.id,
            scanType: scan.scanType,
            location: scan.location,
            forced: scan.forced,
            synced: true,
          });

          // Play audio feedback
          const utterance = new SpeechSynthesisUtterance(message);
          speechSynthesis.speak(utterance);

          toast({
            title: "Success",
            description: message,
          });

          refetchOnboard();
          setShowQRScanner(false);
          setScanMode(null);
          
          // Start 30-second timer for next auto-sync
          if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
          }
          syncTimerRef.current = setTimeout(() => {
            if (pendingScans.length > 0) {
              syncPendingScans();
            }
          }, 30000);
        } catch (error) {
          // If online submit fails, queue for later
          const updatedPending = [...pendingScans, scan];
          setPendingScans(updatedPending);
          localStorage.setItem("pendingScans", JSON.stringify(updatedPending));
          
          toast({
            title: "Queued for Sync",
            description: `${message} - Will sync when connection improves`,
          });
          
          setShowQRScanner(false);
          setScanMode(null);
        }
      } else {
        // Offline mode - queue scan
        const updatedPending = [...pendingScans, scan];
        setPendingScans(updatedPending);
        localStorage.setItem("pendingScans", JSON.stringify(updatedPending));
        
        toast({
          title: "Offline Scan Saved",
          description: `${message} - Will sync when online`,
        });
        
        setShowQRScanner(false);
        setScanMode(null);
      }
    } catch (error) {
      console.error("QR scan error:", error);
      toast({
        title: "Error",
        description: "Invalid QR code format",
        variant: "destructive",
      });
    }
  };

  const syncPendingScans = async () => {
    if (!session || pendingScans.length === 0 || !isOnline || isSyncing) return;

    setIsSyncing(true);

    try {
      const results = await Promise.allSettled(
        pendingScans.map(scan => 
          apiRequest("POST", "/api/driver/scan", {
            studentId: scan.studentId,
            driverId: session.driver.id,
            vehicleId: session.vehicle.id,
            shiftId: session.shift.id,
            scanType: scan.scanType,
            location: scan.location,
            forced: scan.forced,
            synced: true,
          })
        )
      );

      const successCount = results.filter(r => r.status === "fulfilled").length;
      const failedCount = results.filter(r => r.status === "rejected").length;

      if (successCount > 0) {
        // Remove successful scans
        const failedIndices = results
          .map((r, i) => r.status === "rejected" ? i : -1)
          .filter(i => i !== -1);
        
        const remainingScans = pendingScans.filter((_, i) => failedIndices.includes(i));
        setPendingScans(remainingScans);
        localStorage.setItem("pendingScans", JSON.stringify(remainingScans));
        
        setLastSyncTime(new Date());
        
        toast({
          title: "Sync Complete",
          description: `${successCount} scan(s) synced${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
        });

        refetchOnboard();
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync scans. Will retry later.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-driver-login-title">Driver Login</CardTitle>
              <CardDescription>Enter your credentials to access the driver portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="driver-name">Driver Name</Label>
                <Input
                  id="driver-name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  data-testid="input-driver-name"
                />
              </div>
              <div>
                <Label htmlFor="company-number">Company Number</Label>
                <Input
                  id="company-number"
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  data-testid="input-company-number"
                />
              </div>
              <Button 
                onClick={handleLogin} 
                disabled={loginMutation.isPending}
                className="w-full"
                data-testid="button-login"
              >
                {loginMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Vehicle/Shift selection screen
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle data-testid="text-shift-selection-title">Start Your Shift</CardTitle>
                  <CardDescription>Select vehicle and shift</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="vehicle-select">Vehicle</Label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger id="vehicle-select" data-testid="select-vehicle">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {(vehiclesData?.data || []).map((vehicle: Vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        Bus {vehicle.busNumber} - {vehicle.registrationNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shift-select">Shift</Label>
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger id="shift-select" data-testid="select-shift">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {(shiftsData?.data || []).map((shift: Shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.shiftNumber} - {shift.shiftTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleStartShift} 
                className="w-full"
                data-testid="button-start-shift"
              >
                Start Shift
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main scanning interface
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-driver-portal-title">
              Driver Portal
            </h1>
            <p className="text-muted-foreground">
              {session.driver.driverName} - Bus {session.vehicle.busNumber} - {session.shift.shiftTitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnboardList(true)}
              data-testid="button-see-onboard"
            >
              <Users className="w-4 h-4 mr-2" />
              See All Onboard ({onboardData?.data.length || 0})
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-end-shift"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Connection and sync status */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-4">
            <Badge variant={isOnline ? "default" : "secondary"} data-testid="badge-connection-status">
              {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {isOnline ? "Online" : "Offline"}
            </Badge>
            {pendingScans.length > 0 && (
              <Badge variant="outline" data-testid="badge-pending-scans">
                {pendingScans.length} scan(s) pending sync
              </Badge>
            )}
            {lastSyncTime && (
              <span className="text-sm text-muted-foreground">
                Last synced: {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </div>
          {pendingScans.length > 0 && isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncPendingScans}
              disabled={isSyncing}
              data-testid="button-manual-sync"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Now
            </Button>
          )}
        </div>

        {/* Scan buttons */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card className="hover-elevate cursor-pointer" onClick={() => handleScanButtonClick("Board")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="button-scan-board">
                <Camera className="w-5 h-5" />
                Scan to Board
              </CardTitle>
              <CardDescription>Scan student QR code to board the bus</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => handleScanButtonClick("Alight")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="button-scan-alight">
                <Camera className="w-5 h-5" />
                Scan to Alight
              </CardTitle>
              <CardDescription>Scan student QR code to alight from bus</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* QR Scanner Dialog (Placeholder) */}
        <Dialog open={showQRScanner} onOpenChange={setShowQRScanner}>
          <DialogContent data-testid="dialog-qr-scanner">
            <DialogHeader>
              <DialogTitle>Scan QR Code - {scanMode}</DialogTitle>
              <DialogDescription>
                Camera scanning will be implemented here. For now, paste QR data manually.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Camera integration pending. Paste JSON QR data for testing.
              </AlertDescription>
            </Alert>
            <div className="space-y-4">
              <div>
                <Label htmlFor="qr-input">QR Code Data</Label>
                <Input
                  id="qr-input"
                  placeholder='{"studentId":"...","name":"...","version":1}'
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  data-testid="input-qr-data"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleQRScan} className="flex-1" data-testid="button-confirm-scan">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm {scanMode}
                </Button>
                <Button variant="outline" onClick={() => setShowQRScanner(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Onboard Students List */}
        <Dialog open={showOnboardList} onOpenChange={setShowOnboardList}>
          <DialogContent className="max-w-2xl" data-testid="dialog-onboard-list">
            <DialogHeader>
              <DialogTitle>Students Currently On Board</DialogTitle>
              <DialogDescription>
                Bus {session.vehicle.busNumber} - {session.shift.shiftTitle}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {onboardData?.data && onboardData.data.length > 0 ? (
                onboardData.data.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.school}</p>
                        </div>
                        <Badge>{student.status || "Boarded"}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Alert>
                  <AlertDescription>No students currently on board</AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
