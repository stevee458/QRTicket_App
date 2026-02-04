import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, LogOut, Users, WifiOff, Wifi, RefreshCw, Camera, AlertCircle, CheckCircle2, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Html5Qrcode } from "html5-qrcode";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  id: string; // Unique identifier for this scan
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

interface QRScannerProps {
  onScan: (qrData: string) => void;
  onError: (error: string) => void;
  isActive: boolean;
}

function QRScanner({ onScan, onError, isActive }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const stopPromiseRef = useRef<Promise<void> | null>(null);

  // Safe cleanup helper - handles all error cases
  const safeStopScanner = async () => {
    // If already stopping, wait for it to complete
    if (stopPromiseRef.current) {
      await stopPromiseRef.current;
      return;
    }

    // Capture the scanner instance we're about to stop
    const scannerToStop = scannerRef.current;
    if (!scannerToStop) {
      return;
    }

    // Create and store the stop promise
    stopPromiseRef.current = (async () => {
      try {
        await scannerToStop.stop();
      } catch (err) {
        // Scanner might already be stopped or in invalid state - safe to ignore
        console.warn("Scanner stop warning (safe to ignore):", err);
      }

      try {
        scannerToStop.clear();
      } catch (err) {
        // Clear might fail if DOM changed - safe to ignore
        console.warn("Scanner clear warning (safe to ignore):", err);
      }

      // Only null the ref if it still points to the instance we just stopped
      if (scannerRef.current === scannerToStop) {
        scannerRef.current = null;
      }
    })();

    await stopPromiseRef.current;
    stopPromiseRef.current = null;
  };

  useEffect(() => {
    const scannerId = "qr-reader";
    
    // Always reset processing flag when isActive changes
    processingRef.current = false;
    hasScannedRef.current = false;
    
    if (!isActive) {
      // Stop scanner when inactive
      safeStopScanner();
      return;
    }

    // Active - stop any existing scanner and create fresh one
    const startScanner = async () => {
      await safeStopScanner();
      
      // Create new scanner instance
      try {
        scannerRef.current = new Html5Qrcode(scannerId);
      } catch (err) {
        console.error("Error creating scanner instance:", err);
        onError("Failed to initialize camera.");
        return;
      }

      try {
        await scannerRef.current.start(
          { facingMode: "environment" }, // Use back camera for phones
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            // Prevent multiple scans
            if (processingRef.current || hasScannedRef.current) return;
            
            processingRef.current = true;
            hasScannedRef.current = true;
            
            try {
              await onScan(decodedText);
            } catch (error) {
              console.error("Scan processing error:", error);
            } finally {
              processingRef.current = false;
            }
          },
          (errorMessage) => {
            // Ignore common scanning errors
            if (!errorMessage.includes("NotFoundException")) {
              console.warn("QR scan error:", errorMessage);
            }
          }
        );
      } catch (err) {
        console.error("Error starting scanner:", err);
        onError("Failed to start camera. Please check permissions.");
        scannerRef.current = null;
      }
    };

    startScanner();

    // Cleanup when isActive changes or component unmounts
    return () => {
      safeStopScanner();
    };
  }, [isActive, onScan, onError]);

  // Always render container so DOM element exists
  return (
    <div className="w-full">
      <div id="qr-reader" className="w-full" data-testid="qr-scanner-viewport"></div>
    </div>
  );
}

function DriverPageContent() {
  const { toast } = useToast();
  
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  
  // Session state
  const [session, setSession] = useState<DriverSession | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState("");
  
  // Logout confirmation
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  
  // End shift confirmation
  const [showEndShiftDialog, setShowEndShiftDialog] = useState(false);
  const [isEndingShift, setIsEndingShift] = useState(false);
  
  // Scanning state
  const [scanMode, setScanMode] = useState<"Board" | "Alight" | null>(null);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState("");
  const qrInputRef = useRef(qrInput);
  const [showOnboardList, setShowOnboardList] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  
  // Autocomplete state
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ student: StudentWithStatus; parent: any }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ studentId: string; studentName: string } | null>(null);
  const manualEntryInputRef = useRef<HTMLInputElement>(null);
  
  // Offline sync state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSyncRef = useRef<NodeJS.Timeout | null>(null);
  const syncInFlightRef = useRef<boolean>(false);
  
  // GPS tracking state
  const [currentLocation, setCurrentLocation] = useState<string>("GPS: Placeholder");
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(false);
  const [showGpsWarning, setShowGpsWarning] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const currentLocationRef = useRef<string>("GPS: Placeholder");
  
  // Recent scans tracking - prevent duplicate scans within 3 seconds
  const recentScansRef = useRef<Map<string, number>>(new Map());
  const syncPendingScansRef = useRef<(() => Promise<void>) | null>(null);
  const isProcessingManualSelectionRef = useRef<boolean>(false);

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

  // GPS tracking - request permission once and continuously track location
  useEffect(() => {
    if (!isLoggedIn || !("geolocation" in navigator)) {
      return;
    }

    // Request permission and start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationString = `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setCurrentLocation(locationString);
        currentLocationRef.current = locationString;
        setGpsPermissionGranted(true);
      },
      (error) => {
        console.error("GPS error:", error);
        setCurrentLocation("GPS: Unavailable");
        currentLocationRef.current = "GPS: Unavailable";
        setGpsPermissionGranted(false);
        setShowGpsWarning(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000, // Cache location for 30 seconds
      }
    );

    // Cleanup on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isLoggedIn]);

  // Clean up recent scans map every 5 seconds to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(recentScansRef.current.entries());
      
      entries.forEach(([studentId, timestamp]) => {
        // Remove entries older than 5 seconds
        if (now - timestamp > 5000) {
          recentScansRef.current.delete(studentId);
        }
      });
    }, 5000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Auto-sync logic - setup periodic sync when online
  useEffect(() => {
    // Clear any existing periodic sync
    if (periodicSyncRef.current) {
      clearInterval(periodicSyncRef.current);
      periodicSyncRef.current = null;
    }
    
    if (isOnline && !isSyncing) {
      // Start periodic sync every 3 minutes
      periodicSyncRef.current = setInterval(() => {
        // Check pendingScans at execution time, not closure time
        const savedScans = localStorage.getItem("pendingScans");
        if (savedScans) {
          try {
            const scans = JSON.parse(savedScans);
            if (scans.length > 0 && syncPendingScansRef.current) {
              syncPendingScansRef.current();
            }
          } catch (error) {
            console.error("Error checking pending scans:", error);
          }
        }
      }, 3 * 60 * 1000);
    }
    
    return () => {
      if (periodicSyncRef.current) {
        clearInterval(periodicSyncRef.current);
      }
    };
  }, [isOnline, isSyncing]);
  
  // Trigger immediate sync when coming back online with pending scans
  useEffect(() => {
    if (isOnline && pendingScans.length > 0 && !isSyncing) {
      // Small delay to ensure connection is stable
      const immediateSync = setTimeout(() => {
        if (syncPendingScansRef.current) {
          syncPendingScansRef.current();
        }
      }, 2000);
      
      return () => clearTimeout(immediateSync);
    }
  }, [isOnline, pendingScans.length, isSyncing]);

  // Debounced search for autocomplete
  useEffect(() => {
    // Skip search if we're processing a manual selection
    if (isProcessingManualSelectionRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      if (qrInput.trim().length >= 2 && isManualEntryOpen) {
        setIsSearching(true);
        try {
          const response = await fetch(`/api/search/students?q=${encodeURIComponent(qrInput)}`);
          const result = await response.json();
          if (result.success) {
            setSearchResults(result.data || []);
            setAutocompleteOpen(result.data && result.data.length > 0);
          }
        } catch (error) {
          console.error("Autocomplete search error:", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setAutocompleteOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [qrInput, isManualEntryOpen]);

  // Keep qrInputRef in sync for stable callback references
  useEffect(() => {
    qrInputRef.current = qrInput;
  }, [qrInput]);

  // Auto-focus manual entry input when opened
  useEffect(() => {
    if (isManualEntryOpen && manualEntryInputRef.current) {
      setTimeout(() => {
        manualEntryInputRef.current?.focus();
      }, 100);
    }
  }, [isManualEntryOpen]);

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

  const confirmLogout = () => {
    setShowLogoutDialog(false);
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

  const handleEndShift = async () => {
    if (!session) return;
    
    setIsEndingShift(true);
    
    try {
      const response = await apiRequest("POST", "/api/driver/end-shift", {
        driverId: session.driver.id,
        vehicleId: session.vehicle.id,
        shiftId: session.shift.id,
        location: currentLocationRef.current,
      });
      
      const result = await response.json();
      
      if (result.success) {
        const forceCount = result.data.forceAlightedCount;
        
        setShowEndShiftDialog(false);
        setSession(null);
        localStorage.removeItem("driverSession");
        
        toast({
          title: "Shift Ended",
          description: forceCount > 0 
            ? `${forceCount} student(s) were automatically alighted`
            : "Shift ended successfully - no students were on board",
        });
        
        refetchOnboard();
      }
    } catch (error) {
      console.error("End shift error:", error);
      toast({
        title: "Error",
        description: "Failed to end shift. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEndingShift(false);
    }
  };

  const handleScanButtonClick = (mode: "Board" | "Alight") => {
    setScanMode(mode);
    setShowScanDialog(true);
    setIsCameraActive(false); // Don't activate camera immediately
    setLastScanResult(null);
    setQrInput("");
  };

  const handleNextScan = () => {
    setIsCameraActive(true);
    setLastScanResult(null);
    setQrInput("");
  };

  const handleBackToMain = () => {
    setShowScanDialog(false);
    setIsCameraActive(false);
    setLastScanResult(null);
    setScanMode(null);
    setIsManualEntryOpen(false);
    setQrInput("");
    setSelectedStudent(null);
    setAutocompleteOpen(false);
    setSearchResults([]);
  };

  const handleQRScan = useCallback(async (scannedData?: string | { studentId: string; studentName: string }) => {
    if (!session) return;

    let studentId: string;
    let studentName: string;
    let dataToProcess: string; // Declare outside to use in scan record

    // Check if scannedData is a student object (from autocomplete)
    if (typeof scannedData === 'object' && scannedData !== null) {
      studentId = scannedData.studentId;
      studentName = scannedData.studentName;
      // Use student ID as qrData for autocomplete selections
      dataToProcess = JSON.stringify({ studentId, name: studentName });
    } else {
      // Process as string (QR code or manual entry)
      dataToProcess = scannedData || qrInputRef.current;
      if (!dataToProcess) return;

      try {
        // Try to parse as JSON (QR code data)
        const parsedQR = JSON.parse(dataToProcess);
        studentId = parsedQR.studentId;
        studentName = parsedQR.name || "Student";
      } catch (jsonError) {
        // If not JSON, treat as student name search
        try {
          const response = await fetch(`/api/search/students?q=${encodeURIComponent(dataToProcess)}`);
          const searchResult = await response.json();
          
          if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
            toast({
              title: "Student Not Found",
              description: `No student found with name: ${dataToProcess}`,
              variant: "destructive",
            });
            setIsCameraActive(false);
            setLastScanResult("❌ Student not found");
            return;
          }
          
          // Use the first match
          const student = searchResult.data[0].student;
          studentId = student.id;
          studentName = student.name;
        } catch (searchError) {
          console.error("Student search error:", searchError);
          toast({
            title: "Error",
            description: "Failed to search for student",
            variant: "destructive",
          });
          setIsCameraActive(false);
          setLastScanResult("❌ Search failed");
          return;
        }
      }
    }

    try {
      const message = scanMode === "Board" ? `Hi ${studentName.split(' ')[0]}` : `Goodbye ${studentName.split(' ')[0]}`;

      // Check if this student was scanned very recently (within 3 seconds)
      const now = Date.now();
      const lastScanTime = recentScansRef.current.get(studentId);
      if (lastScanTime && (now - lastScanTime) < 3000) {
        // Silently ignore duplicate scan within 3 seconds
        setIsCameraActive(false);
        setLastScanResult("Duplicate scan ignored");
        return;
      }

      // Check current status from onboard query using queryClient
      const onboardQueryKey = ["/api/driver/onboard", session?.driver.id, session?.vehicle.id, session?.shift.id];
      const onboardList = queryClient.getQueryData<{ success: boolean; data: StudentWithStatus[] }>(onboardQueryKey)?.data || [];
      const isCurrentlyOnboard = onboardList.some(s => s.id === studentId);

      // Validate scan action
      if (scanMode === "Board" && isCurrentlyOnboard) {
        toast({
          title: "Warning",
          description: `${studentName} is already on board`,
          variant: "destructive",
        });
        setIsCameraActive(false);
        setLastScanResult(`⚠️ ${studentName} already on board`);
        return;
      }

      if (scanMode === "Alight" && !isCurrentlyOnboard) {
        toast({
          title: "Warning",
          description: `${studentName} is not currently on board`,
          variant: "destructive",
        });
        setIsCameraActive(false);
        setLastScanResult(`⚠️ ${studentName} not on board`);
        return;
      }

      // Mark this student as recently scanned
      recentScansRef.current.set(studentId, now);

      // Create scan record with unique ID using current location from ref
      const scan: PendingScan = {
        id: crypto.randomUUID(),
        studentId,
        scanType: scanMode === "Board" ? "On" : "Off",
        location: currentLocationRef.current,
        forced: false,
        scannedAt: new Date().toISOString(),
        qrData: dataToProcess,
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

          // Stop camera but keep dialog open for next scan
          setIsCameraActive(false);
          setLastScanResult(message);
          refetchOnboard();
        } catch (error) {
          // If online submit fails, queue for later
          setPendingScans(prev => {
            const updated = [...prev, scan];
            localStorage.setItem("pendingScans", JSON.stringify(updated));
            return updated;
          });
          
          toast({
            title: "Queued for Sync",
            description: `${message} - Will sync when connection improves`,
          });
          
          // Start 30-second timer for next auto-sync attempt
          if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
          }
          syncTimerRef.current = setTimeout(() => {
            // Check pendingScans from localStorage at execution time
            const savedScans = localStorage.getItem("pendingScans");
            if (savedScans) {
              try {
                const scans = JSON.parse(savedScans);
                if (scans.length > 0 && syncPendingScansRef.current) {
                  syncPendingScansRef.current();
                }
              } catch (err) {
                console.error("Error checking pending scans for sync:", err);
              }
            }
          }, 30000);
          
          // Stop camera but keep dialog open for next scan
          setIsCameraActive(false);
          setLastScanResult(message + " (Queued)");
        }
      } else {
        // Offline mode - queue scan
        setPendingScans(prev => {
          const updated = [...prev, scan];
          localStorage.setItem("pendingScans", JSON.stringify(updated));
          return updated;
        });
        
        toast({
          title: "Offline Scan Saved",
          description: `${message} - Will sync when online`,
        });
        
        // Set 30-second timer for when connection returns
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(() => {
          // Check if we're online and have pending scans at execution time
          const savedScans = localStorage.getItem("pendingScans");
          if (navigator.onLine && savedScans) {
            try {
              const scans = JSON.parse(savedScans);
              if (scans.length > 0 && syncPendingScansRef.current) {
                syncPendingScansRef.current();
              }
            } catch (err) {
              console.error("Error checking pending scans for sync:", err);
            }
          }
        }, 30000);
        
        // Stop camera but keep dialog open for next scan
        setIsCameraActive(false);
        setLastScanResult(message + " (Offline)");
      }
    } catch (error) {
      console.error("QR scan error:", error);
      toast({
        title: "Error",
        description: "Invalid QR code format",
        variant: "destructive",
      });
      setIsCameraActive(false);
      setLastScanResult("❌ Invalid QR code – please rescan");
    }
  }, [session, scanMode, toast, isOnline, refetchOnboard]);

  // Memoized onScan callback to prevent QRScanner from recreating on every render
  const handleScannerScan = useCallback(async (qrData: string) => {
    setQrInput(qrData);
    await handleQRScan(qrData);
  }, [handleQRScan]);

  // Memoized onError callback for QRScanner
  const handleScannerError = useCallback((error: string) => {
    toast({
      title: "Scanner Error",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  const syncPendingScans = useCallback(async () => {
    // Prevent concurrent execution
    if (syncInFlightRef.current) {
      return;
    }
    
    // Read fresh data from localStorage to avoid stale closures
    const savedSession = localStorage.getItem("driverSession");
    const savedScans = localStorage.getItem("pendingScans");
    
    if (!savedSession || !savedScans || !navigator.onLine) {
      return;
    }

    let currentSession: DriverSession;
    let currentScans: PendingScan[];
    
    try {
      currentSession = JSON.parse(savedSession);
      currentScans = JSON.parse(savedScans);
    } catch (error) {
      console.error("Error parsing saved data:", error);
      return;
    }

    if (currentScans.length === 0) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const results = await Promise.allSettled(
        currentScans.map(async (scan) => {
          const response = await fetch("/api/driver/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: scan.studentId,
              driverId: currentSession.driver.id,
              vehicleId: currentSession.vehicle.id,
              shiftId: currentSession.shift.id,
              scanType: scan.scanType,
              location: scan.location,
              forced: scan.forced,
              synced: true,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw { status: response.status, error: data.error, message: data.message };
          }
          return data;
        })
      );

      let successCount = 0;
      let failedCount = 0;
      let studentNotFoundCount = 0;
      const failedIndices: number[] = [];
      const studentNotFoundIndices: number[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          const error = result.reason;
          if (error?.error === "STUDENT_NOT_FOUND") {
            studentNotFoundCount++;
            studentNotFoundIndices.push(index);
          } else {
            failedCount++;
            failedIndices.push(index);
          }
        }
      });

      if (studentNotFoundCount > 0) {
        toast({
          title: "Invalid QR Codes Detected",
          description: `${studentNotFoundCount} scan(s) used outdated QR codes for students that no longer exist. These have been removed.`,
          variant: "destructive",
        });
      }

      if (successCount > 0 || studentNotFoundCount > 0) {
        const failedScansFromBatch = currentScans.filter((_, i) => failedIndices.includes(i));
        
        // Read fresh localStorage to get any scans added during sync
        const freshScans = localStorage.getItem("pendingScans");
        let newlyAddedScans: PendingScan[] = [];
        
        if (freshScans) {
          try {
            const freshScansArray = JSON.parse(freshScans);
            // Find scans that weren't in the original batch (by unique ID)
            const originalIds = new Set(currentScans.map(s => s.id));
            newlyAddedScans = freshScansArray.filter((s: PendingScan) => 
              !originalIds.has(s.id)
            );
          } catch (error) {
            console.error("Error reading fresh scans:", error);
          }
        }
        
        // Atomic merge: Read one final time before writing to catch any last-second additions
        let finalMergedScans: PendingScan[];
        const lastMinuteScans = localStorage.getItem("pendingScans");
        
        if (lastMinuteScans) {
          try {
            const lastMinuteArray = JSON.parse(lastMinuteScans);
            // Rebuild the queue: keep scans not in the successfully-synced batch
            const successfulIds = new Set(
              currentScans
                .filter((_, i) => !failedIndices.includes(i))
                .map(s => s.id)
            );
            finalMergedScans = lastMinuteArray.filter((s: PendingScan) => 
              !successfulIds.has(s.id)
            );
          } catch (error) {
            console.error("Error in final merge:", error);
            // Fallback to previous logic
            finalMergedScans = [...failedScansFromBatch, ...newlyAddedScans];
          }
        } else {
          finalMergedScans = failedScansFromBatch;
        }
        
        setPendingScans(finalMergedScans);
        localStorage.setItem("pendingScans", JSON.stringify(finalMergedScans));
        
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
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [setPendingScans, setLastSyncTime, toast, refetchOnboard]);

  // Keep ref updated
  useEffect(() => {
    syncPendingScansRef.current = syncPendingScans;
  }, [syncPendingScans]);

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="border-t-4 border-t-green-500 shadow-lg">
            <CardHeader className="bg-green-500/5">
              <CardTitle className="text-green-600" data-testid="text-driver-login-title">Driver Login</CardTitle>
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
                <Button variant="ghost" size="icon" onClick={() => setShowLogoutDialog(true)} data-testid="button-logout">
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
                {selectedVehicleId && selectedShiftId ? "Continue Shift" : "Start Shift"}
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
        <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
          <div>
            <h1 className="text-3xl font-bold text-green-600" data-testid="text-driver-portal-title">
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
              variant="destructive"
              size="sm"
              onClick={() => setShowEndShiftDialog(true)}
              data-testid="button-end-shift"
            >
              End Shift
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowLogoutDialog(true)}
              data-testid="button-logout"
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
          <Card className="hover-elevate cursor-pointer border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-950/10" onClick={() => handleScanButtonClick("Board")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600" data-testid="button-scan-board">
                <Camera className="w-5 h-5" />
                Scan to Board
              </CardTitle>
              <CardDescription>Scan student QR code to board the bus</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer border-l-4 border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10" onClick={() => handleScanButtonClick("Alight")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600" data-testid="button-scan-alight">
                <Camera className="w-5 h-5" />
                Scan to Alight
              </CardTitle>
              <CardDescription>Scan student QR code to alight from bus</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* QR Scanner Dialog */}
        <Dialog open={showScanDialog} onOpenChange={(open) => !open && handleBackToMain()}>
          <DialogContent data-testid="dialog-qr-scanner" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {scanMode === "Board" ? "Scanning to Board" : "Scanning to Alight"}
              </DialogTitle>
              <DialogDescription>
                {isCameraActive 
                  ? "Point your camera at the student's QR code"
                  : lastScanResult 
                    ? "Scan complete - Ready for next student"
                    : "Ready to scan"
                }
              </DialogDescription>
            </DialogHeader>
            
            {isCameraActive ? (
              <>
                {/* Camera Scanner */}
                <QRScanner
                  onScan={handleScannerScan}
                  onError={handleScannerError}
                  isActive={isCameraActive}
                />
                
                {/* Manual input fallback */}
                <div className="space-y-4 mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Manual Entry</p>
                  <div>
                    <Input
                      id="student-name-input"
                      placeholder="First and Surname"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      data-testid="input-student-name"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleQRScan(qrInput)} className="flex-1" data-testid="button-confirm-scan">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm {scanMode}
                    </Button>
                    <Button variant="outline" onClick={handleBackToMain}>
                      Back
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Success feedback */}
                {lastScanResult && (
                  <Alert className="mb-6">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription data-testid="text-last-scan-result">
                      {lastScanResult}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Primary action - Large circular Next Scan button */}
                <div className="flex flex-col items-center gap-3 mb-6">
                  <Button 
                    onClick={handleNextScan} 
                    className="h-32 w-32 rounded-full flex flex-col items-center justify-center gap-2 text-base font-semibold" 
                    data-testid="button-next-scan"
                    disabled={!gpsPermissionGranted}
                  >
                    <Camera className="w-8 h-8" />
                    <span>Next Scan</span>
                  </Button>
                  {!gpsPermissionGranted && (
                    <p className="text-sm text-muted-foreground text-center">
                      Camera scanning disabled - Use Manual Entry below
                    </p>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={handleBackToMain}
                    data-testid="button-back-to-main"
                  >
                    Back
                  </Button>
                </div>
                
                {/* Collapsible Manual Entry - Secondary fallback option */}
                <Collapsible open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
                  <div className="pt-4 border-t">
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full flex items-center justify-between p-2 hover-elevate"
                        data-testid="button-toggle-manual-entry"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`h-4 w-4 transition-transform ${isManualEntryOpen ? 'rotate-180' : ''}`} />
                          <span className="text-sm font-medium">Manual Entry</span>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <p className="text-xs text-muted-foreground mb-3">
                        Type student name to search
                      </p>
                      <div className="space-y-3">
                        <Popover open={autocompleteOpen} onOpenChange={setAutocompleteOpen}>
                          <PopoverTrigger asChild>
                            <div className="relative">
                              <Input
                                ref={manualEntryInputRef}
                                id="student-name-input-initial"
                                placeholder="Type student name..."
                                value={qrInput}
                                onChange={(e) => setQrInput(e.target.value)}
                                onFocus={() => {
                                  if (searchResults.length > 0) {
                                    setAutocompleteOpen(true);
                                  }
                                }}
                                data-testid="input-student-name-initial"
                              />
                              {isSearching && (
                                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <Command>
                              <CommandList>
                                {searchResults.length === 0 ? (
                                  <CommandEmpty>
                                    {qrInput.trim().length >= 2 ? "No students found" : "Start typing to search..."}
                                  </CommandEmpty>
                                ) : (
                                  <CommandGroup>
                                    {searchResults.map((result) => (
                                      <CommandItem
                                        key={result.student.id}
                                        value={result.student.name}
                                        onSelect={() => {
                                          const selected = {
                                            studentId: result.student.id,
                                            studentName: result.student.name,
                                          };
                                          
                                          // Set flag to prevent debounced search from re-triggering
                                          isProcessingManualSelectionRef.current = true;
                                          
                                          setSelectedStudent(selected);
                                          setQrInput(selected.studentName);
                                          setAutocompleteOpen(false);
                                          setSearchResults([]);
                                          
                                          // Reset flag after a brief delay
                                          setTimeout(() => {
                                            isProcessingManualSelectionRef.current = false;
                                          }, 100);
                                        }}
                                        data-testid={`autocomplete-item-${result.student.id}`}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <div className="flex flex-col">
                                            <span className="font-medium">{result.student.name}</span>
                                            <span className="text-xs text-muted-foreground">{result.student.school}</span>
                                          </div>
                                          <Check className="h-4 w-4 opacity-0" />
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button 
                          onClick={() => {
                            if (selectedStudent) {
                              handleQRScan(selectedStudent);
                              setSelectedStudent(null);
                            } else {
                              handleQRScan(qrInput);
                            }
                            setQrInput("");
                            setSearchResults([]);
                            setAutocompleteOpen(false);
                          }}
                          className="w-full" 
                          variant="outline"
                          disabled={!qrInput.trim()}
                          data-testid="button-manual-confirm"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Confirm {scanMode}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </>
            )}
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

        {/* GPS Warning Dialog */}
        <Dialog open={showGpsWarning} onOpenChange={setShowGpsWarning}>
          <DialogContent data-testid="dialog-gps-warning">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                GPS Unavailable
              </DialogTitle>
              <DialogDescription>
                Cannot access the GPS function on this device. Camera scanning will be disabled, but you can still use Manual Entry to scan students.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setShowGpsWarning(false)} data-testid="button-close-gps-warning">
              I Understand
            </Button>
          </DialogContent>
        </Dialog>

        {/* Logout confirmation dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log Out?</AlertDialogTitle>
              <AlertDialogDescription>
                You can close the app without logging out - your session will remain active for your next shift. Only log out if you're done for the day or switching to a different driver.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-logout">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmLogout} data-testid="button-confirm-logout">
                Log Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* End Shift confirmation dialog */}
        <AlertDialog open={showEndShiftDialog} onOpenChange={setShowEndShiftDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End Shift?</AlertDialogTitle>
              <AlertDialogDescription>
                {onboardData?.data && onboardData.data.length > 0 ? (
                  <>
                    <span className="text-destructive font-semibold">
                      Warning: {onboardData.data.length} student(s) are still on board.
                    </span>
                    <br />
                    Ending the shift will automatically mark them as alighted (force alight). 
                    This action cannot be undone.
                  </>
                ) : (
                  "No students are currently on board. Are you sure you want to end this shift?"
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-end-shift" disabled={isEndingShift}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleEndShift} 
                data-testid="button-confirm-end-shift"
                disabled={isEndingShift}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isEndingShift ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ending...
                  </>
                ) : (
                  "End Shift"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function DriverPage() {
  return (
    <ErrorBoundary
      fallbackTitle="Driver Portal Unavailable"
      fallbackDescription="This page requires camera and location permissions. Please try on a mobile device or grant permissions in your browser settings."
    >
      <DriverPageContent />
    </ErrorBoundary>
  );
}
