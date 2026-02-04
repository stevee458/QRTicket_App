import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, LogOut, Users, WifiOff, Wifi, RefreshCw, Camera, AlertCircle, CheckCircle2, ChevronDown, Check, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Html5Qrcode } from "html5-qrcode";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface VenueStaff {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  locationLat: string | number | null;
  locationLng: string | number | null;
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
  id: string;
  studentId: string;
  scanType: "In" | "Out";
  location: string;
  locationConfirmed: boolean;
  forced: boolean;
  scannedAt: string;
  qrData: string;
}

interface VenueSession {
  staff: VenueStaff;
  venue: Venue;
}

interface QRScannerProps {
  onScan: (qrData: string) => void;
  onError: (error: string) => void;
  isActive: boolean;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function QRScanner({ onScan, onError, isActive }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const stopPromiseRef = useRef<Promise<void> | null>(null);

  const safeStopScanner = async () => {
    if (stopPromiseRef.current) {
      await stopPromiseRef.current;
      return;
    }

    const scannerToStop = scannerRef.current;
    if (!scannerToStop) {
      return;
    }

    stopPromiseRef.current = (async () => {
      try {
        await scannerToStop.stop();
      } catch (err) {
        console.warn("Scanner stop warning (safe to ignore):", err);
      }

      try {
        scannerToStop.clear();
      } catch (err) {
        console.warn("Scanner clear warning (safe to ignore):", err);
      }

      // Explicitly stop all video tracks to ensure camera is released
      try {
        const videoElements = document.querySelectorAll('#venue-qr-reader video');
        videoElements.forEach((video: any) => {
          if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach((track: MediaStreamTrack) => track.stop());
            video.srcObject = null;
          }
        });
      } catch (err) {
        console.warn("Track stop warning (safe to ignore):", err);
      }

      if (scannerRef.current === scannerToStop) {
        scannerRef.current = null;
      }
    })();

    await stopPromiseRef.current;
    stopPromiseRef.current = null;
  };

  useEffect(() => {
    const scannerId = "venue-qr-reader";
    
    processingRef.current = false;
    hasScannedRef.current = false;
    
    if (!isActive) {
      safeStopScanner();
      return;
    }

    const startScanner = async () => {
      await safeStopScanner();
      
      try {
        scannerRef.current = new Html5Qrcode(scannerId);
      } catch (err) {
        console.error("Error creating scanner instance:", err);
        onError("Failed to initialize camera.");
        return;
      }

      try {
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
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

    return () => {
      safeStopScanner();
    };
  }, [isActive, onScan, onError]);

  return (
    <div className="w-full">
      <div id="venue-qr-reader" className="w-full" data-testid="venue-qr-scanner-viewport"></div>
    </div>
  );
}

function VenuePageContent() {
  const { toast } = useToast();
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [password, setPassword] = useState("");
  
  const [session, setSession] = useState<VenueSession | null>(null);
  
  // Logout confirmation
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  
  const [scanMode, setScanMode] = useState<"In" | "Out" | null>(null);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState("");
  const qrInputRef = useRef(qrInput);
  const [showAtVenueList, setShowAtVenueList] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ student: StudentWithStatus; parent: any }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ studentId: string; studentName: string } | null>(null);
  const manualEntryInputRef = useRef<HTMLInputElement>(null);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSyncRef = useRef<NodeJS.Timeout | null>(null);
  const syncInFlightRef = useRef<boolean>(false);
  
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentLocationString, setCurrentLocationString] = useState<string>("GPS: Placeholder");
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(false);
  const [showGpsWarning, setShowGpsWarning] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const currentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [forceScanData, setForceScanData] = useState<{ studentId: string; studentName: string; scanType: "In" | "Out" } | null>(null);
  
  // Camera permission state: 'unknown' | 'checking' | 'granted' | 'denied' | 'unavailable'
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'checking' | 'granted' | 'denied' | 'unavailable'>('unknown');
  
  const recentScansRef = useRef<Map<string, number>>(new Map());
  const syncPendingScansRef = useRef<(() => Promise<void>) | null>(null);
  const isProcessingManualSelectionRef = useRef<boolean>(false);

  useEffect(() => {
    const savedSession = localStorage.getItem("venueSession");
    const savedPendingScans = localStorage.getItem("venuePendingScans");
    
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed);
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Error loading session:", error);
        localStorage.removeItem("venueSession");
      }
    }
    
    if (savedPendingScans) {
      try {
        setPendingScans(JSON.parse(savedPendingScans));
      } catch (error) {
        console.error("Error loading pending scans:", error);
        localStorage.removeItem("venuePendingScans");
      }
    }
  }, []);

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

  useEffect(() => {
    if (!isLoggedIn || !("geolocation" in navigator)) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationObj = { lat: latitude, lng: longitude };
        setCurrentLocation(locationObj);
        currentLocationRef.current = locationObj;
        setCurrentLocationString(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setGpsPermissionGranted(true);
        
        if (session?.venue && session.venue.locationLat && session.venue.locationLng) {
          const venueLat = typeof session.venue.locationLat === 'string' 
            ? parseFloat(session.venue.locationLat) 
            : session.venue.locationLat;
          const venueLng = typeof session.venue.locationLng === 'string' 
            ? parseFloat(session.venue.locationLng) 
            : session.venue.locationLng;
          
          if (!isNaN(venueLat) && !isNaN(venueLng)) {
            const distance = calculateDistance(latitude, longitude, venueLat, venueLng);
            setLocationConfirmed(distance <= 250);
          }
        }
      },
      (error) => {
        console.error("GPS error:", error);
        setCurrentLocationString("GPS: Unavailable");
        setGpsPermissionGranted(false);
        setShowGpsWarning(true);
        setLocationConfirmed(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isLoggedIn, session?.venue]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(recentScansRef.current.entries());
      
      entries.forEach(([studentId, timestamp]) => {
        if (now - timestamp > 5000) {
          recentScansRef.current.delete(studentId);
        }
      });
    }, 5000);

    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    if (periodicSyncRef.current) {
      clearInterval(periodicSyncRef.current);
      periodicSyncRef.current = null;
    }
    
    if (isOnline && !isSyncing) {
      periodicSyncRef.current = setInterval(() => {
        const savedScans = localStorage.getItem("venuePendingScans");
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
  
  useEffect(() => {
    if (isOnline && pendingScans.length > 0 && !isSyncing) {
      const immediateSync = setTimeout(() => {
        if (syncPendingScansRef.current) {
          syncPendingScansRef.current();
        }
      }, 2000);
      
      return () => clearTimeout(immediateSync);
    }
  }, [isOnline, pendingScans.length, isSyncing]);

  useEffect(() => {
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

  useEffect(() => {
    if (isManualEntryOpen && manualEntryInputRef.current) {
      setTimeout(() => {
        manualEntryInputRef.current?.focus();
      }, 100);
    }
  }, [isManualEntryOpen]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { name: string; password: string }) => {
      const response = await apiRequest("POST", "/api/venue/login", credentials);
      return await response.json();
    },
    onSuccess: (data: { success: boolean; data: { staff: VenueStaff; venue: Venue } }) => {
      const venueSession: VenueSession = {
        staff: data.data.staff,
        venue: data.data.venue,
      };
      setSession(venueSession);
      localStorage.setItem("venueSession", JSON.stringify(venueSession));
      toast({
        title: "Login Successful",
        description: `Welcome to ${data.data.venue.name}!`,
      });
      setIsLoggedIn(true);
    },
    onError: async () => {
      const savedSession = localStorage.getItem("venueSession");
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (parsed.staff?.name === staffName) {
            setSession(parsed);
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

  const { data: atVenueData, refetch: refetchAtVenue } = useQuery<{ success: boolean; data: StudentWithStatus[] }>({
    queryKey: ["/api/venue/at-venue", session?.venue.id],
    enabled: !!session,
    refetchInterval: 30000,
  });

  const handleLogin = () => {
    if (!staffName || !password) {
      toast({
        title: "Validation Error",
        description: "Please enter both name and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ name: staffName, password });
  };

  const confirmLogout = async () => {
    setShowLogoutDialog(false);
    try {
      await apiRequest("POST", "/api/venue/logout", {});
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    setIsLoggedIn(false);
    setSession(null);
    setStaffName("");
    setPassword("");
    localStorage.removeItem("venueSession");
    
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
  };

  // Check and request camera permission
  const checkCameraPermission = useCallback(async (): Promise<boolean> => {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('unavailable');
      return false;
    }

    setCameraPermission('checking');

    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately - we just needed to get permission
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
      return true;
    } catch (error: any) {
      console.error("Camera permission error:", error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraPermission('denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraPermission('unavailable');
      } else {
        setCameraPermission('denied');
      }
      return false;
    }
  }, []);

  const handleScanButtonClick = (mode: "In" | "Out") => {
    setScanMode(mode);
    setShowScanDialog(true);
    setIsCameraActive(false);
    setLastScanResult(null);
    setQrInput("");
  };

  const handleNextScan = async () => {
    // If camera permission unknown, check it first
    if (cameraPermission === 'unknown') {
      const granted = await checkCameraPermission();
      if (granted) {
        setIsCameraActive(true);
      }
    } else if (cameraPermission === 'granted') {
      setIsCameraActive(true);
    }
    // If denied/unavailable, don't activate camera - manual entry shown instead
    setLastScanResult(null);
    setQrInput("");
  };

  const handleRequestCameraAccess = async () => {
    await checkCameraPermission();
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

  const speak = (message: string) => {
    const utterance = new SpeechSynthesisUtterance(message);
    speechSynthesis.speak(utterance);
  };

  const processVenueScan = useCallback(async (
    studentId: string, 
    studentName: string, 
    qrData: string,
    forced: boolean = false
  ) => {
    if (!session) return;

    const message = scanMode === "In" ? `Welcome ${studentName.split(' ')[0]}` : `Goodbye ${studentName.split(' ')[0]}`;

    const now = Date.now();
    if (!forced) {
      const lastScanTime = recentScansRef.current.get(studentId);
      if (lastScanTime && (now - lastScanTime) < 3000) {
        setIsCameraActive(false);
        setLastScanResult("Duplicate scan ignored");
        return;
      }
    }

    recentScansRef.current.set(studentId, now);

    const scan: PendingScan = {
      id: crypto.randomUUID(),
      studentId,
      scanType: scanMode === "In" ? "In" : "Out",
      location: currentLocationString,
      locationConfirmed,
      forced,
      scannedAt: new Date().toISOString(),
      qrData,
    };

    if (isOnline) {
      try {
        await apiRequest("POST", "/api/venue-scans", {
          venueId: session.venue.id,
          staffId: session.staff.id,
          studentId,
          scanType: scan.scanType,
          location: scan.location,
          locationConfirmed: scan.locationConfirmed,
          forced: scan.forced,
        });

        speak(message);

        toast({
          title: "Success",
          description: message,
        });

        setIsCameraActive(false);
        setLastScanResult(message);
        refetchAtVenue();
      } catch (error: any) {
        // Check if it's a "student not found" error - don't queue these
        const errorData = error?.error || error?.message || "";
        const isStudentNotFound = errorData === "STUDENT_NOT_FOUND" || 
          (typeof errorData === "string" && errorData.toLowerCase().includes("student not found"));
        
        if (isStudentNotFound) {
          // Student doesn't exist - show error, don't queue
          toast({
            title: "Student Not Found",
            description: "This QR code is not registered in the system",
            variant: "destructive",
          });
          setIsCameraActive(false);
          setLastScanResult("Student not found - QR not recognized");
        } else {
          // Network/other error - queue for later sync
          setPendingScans(prev => {
            const updated = [...prev, scan];
            localStorage.setItem("venuePendingScans", JSON.stringify(updated));
            return updated;
          });
          
          toast({
            title: "Queued for Sync",
            description: `${message} - Will sync when connection improves`,
          });
          
          if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
          }
          syncTimerRef.current = setTimeout(() => {
            const savedScans = localStorage.getItem("venuePendingScans");
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
          
          setIsCameraActive(false);
          setLastScanResult(message + " (Queued)");
        }
      }
    } else {
      setPendingScans(prev => {
        const updated = [...prev, scan];
        localStorage.setItem("venuePendingScans", JSON.stringify(updated));
        return updated;
      });
      
      toast({
        title: "Offline Scan Saved",
        description: `${message} - Will sync when online`,
      });
      
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = setTimeout(() => {
        const savedScans = localStorage.getItem("venuePendingScans");
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
      
      setIsCameraActive(false);
      setLastScanResult(message + " (Offline)");
    }
  }, [session, scanMode, currentLocationString, locationConfirmed, isOnline, toast, refetchAtVenue]);

  const handleQRScan = useCallback(async (scannedData?: string | { studentId: string; studentName: string }) => {
    if (!session) return;

    let studentId: string;
    let studentName: string;
    let dataToProcess: string;

    if (typeof scannedData === 'object' && scannedData !== null) {
      studentId = scannedData.studentId;
      studentName = scannedData.studentName;
      dataToProcess = JSON.stringify({ studentId, name: studentName });
    } else {
      dataToProcess = scannedData || qrInputRef.current;
      if (!dataToProcess) return;

      try {
        const parsedQR = JSON.parse(dataToProcess);
        studentId = parsedQR.studentId;
        studentName = parsedQR.name || "Student";
      } catch (jsonError) {
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
            setLastScanResult("Student not found");
            return;
          }
          
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
          setLastScanResult("Search failed");
          return;
        }
      }
    }

    try {
      const atVenueQueryKey = ["/api/venue/at-venue", session?.venue.id];
      const atVenueList = queryClient.getQueryData<{ success: boolean; data: StudentWithStatus[] }>(atVenueQueryKey)?.data || [];
      const isCurrentlyAtVenue = atVenueList.some(s => s.id === studentId);

      if (scanMode === "In" && isCurrentlyAtVenue) {
        setForceScanData({ studentId, studentName, scanType: "In" });
        setShowForceDialog(true);
        setIsCameraActive(false);
        return;
      }

      if (scanMode === "Out" && !isCurrentlyAtVenue) {
        setForceScanData({ studentId, studentName, scanType: "Out" });
        setShowForceDialog(true);
        setIsCameraActive(false);
        return;
      }

      await processVenueScan(studentId, studentName, dataToProcess, false);
    } catch (error) {
      console.error("QR scan error:", error);
      toast({
        title: "Error",
        description: "Invalid QR code format",
        variant: "destructive",
      });
      setIsCameraActive(false);
      setLastScanResult("Invalid QR code – please rescan");
    }
  }, [session, scanMode, toast, processVenueScan]);

  const handleForceScan = async () => {
    if (!forceScanData) return;
    
    await processVenueScan(
      forceScanData.studentId, 
      forceScanData.studentName, 
      JSON.stringify({ studentId: forceScanData.studentId, name: forceScanData.studentName }),
      true
    );
    
    setShowForceDialog(false);
    setForceScanData(null);
  };

  const handleCancelForceScan = () => {
    setShowForceDialog(false);
    setForceScanData(null);
    setLastScanResult(forceScanData?.scanType === "In" 
      ? `${forceScanData.studentName} already at venue` 
      : `${forceScanData?.studentName} not at venue`);
  };

  const handleScannerScan = useCallback(async (qrData: string) => {
    setQrInput(qrData);
    await handleQRScan(qrData);
  }, [handleQRScan]);

  const handleScannerError = useCallback((error: string) => {
    toast({
      title: "Scanner Error",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  const syncPendingScans = useCallback(async () => {
    if (syncInFlightRef.current) {
      return;
    }
    
    const savedSession = localStorage.getItem("venueSession");
    const savedScans = localStorage.getItem("venuePendingScans");
    
    if (!savedSession || !savedScans || !navigator.onLine) {
      return;
    }

    let currentSession: VenueSession;
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
          const response = await fetch("/api/venue-scans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              venueId: currentSession.venue.id,
              staffId: currentSession.staff.id,
              studentId: scan.studentId,
              scanType: scan.scanType,
              location: scan.location,
              locationConfirmed: scan.locationConfirmed,
              forced: scan.forced,
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
        
        const freshScans = localStorage.getItem("venuePendingScans");
        let newlyAddedScans: PendingScan[] = [];
        
        if (freshScans) {
          try {
            const freshScansArray = JSON.parse(freshScans);
            const originalIds = new Set(currentScans.map(s => s.id));
            newlyAddedScans = freshScansArray.filter((s: PendingScan) => 
              !originalIds.has(s.id)
            );
          } catch (error) {
            console.error("Error reading fresh scans:", error);
          }
        }
        
        let finalMergedScans: PendingScan[];
        const lastMinuteScans = localStorage.getItem("venuePendingScans");
        
        if (lastMinuteScans) {
          try {
            const lastMinuteArray = JSON.parse(lastMinuteScans);
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
            finalMergedScans = [...failedScansFromBatch, ...newlyAddedScans];
          }
        } else {
          finalMergedScans = failedScansFromBatch;
        }
        
        setPendingScans(finalMergedScans);
        localStorage.setItem("venuePendingScans", JSON.stringify(finalMergedScans));
        
        setLastSyncTime(new Date());
        
        toast({
          title: "Sync Complete",
          description: `${successCount} scan(s) synced${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
        });

        refetchAtVenue();
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
  }, [setPendingScans, setLastSyncTime, toast, refetchAtVenue]);

  useEffect(() => {
    syncPendingScansRef.current = syncPendingScans;
  }, [syncPendingScans]);

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="border-t-4 border-t-blue-500 shadow-lg">
            <CardHeader className="bg-blue-500/5">
              <CardTitle className="text-blue-600" data-testid="text-venue-login-title">Venue Staff Login</CardTitle>
              <CardDescription>Enter your credentials to access the venue portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  data-testid="input-staff-name"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  data-testid="input-password"
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-blue-500/5 border-l-4 border-l-blue-500">
          <div>
            <h1 className="text-3xl font-bold text-blue-600" data-testid="text-venue-portal-title">
              Venue Portal
            </h1>
            <p className="text-muted-foreground">
              {session?.venue.name} - {session?.staff.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAtVenueList(true)}
              data-testid="button-see-at-venue"
            >
              <Users className="w-4 h-4 mr-2" />
              At Venue ({atVenueData?.data?.length || 0})
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

        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant={isOnline ? "default" : "secondary"} data-testid="badge-connection-status">
              {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {isOnline ? "Online" : "Offline"}
            </Badge>
            <Badge variant={locationConfirmed ? "default" : "outline"} data-testid="badge-location-status">
              <MapPin className="w-3 h-3 mr-1" />
              {locationConfirmed ? "Location Confirmed" : "Location Not Confirmed"}
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

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card className="hover-elevate cursor-pointer border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10" onClick={() => handleScanButtonClick("In")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600" data-testid="button-scan-in">
                <Camera className="w-5 h-5" />
                Scan In
              </CardTitle>
              <CardDescription>Scan student QR code to check in at venue</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer border-l-4 border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10" onClick={() => handleScanButtonClick("Out")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600" data-testid="button-scan-out">
                <Camera className="w-5 h-5" />
                Scan Out
              </CardTitle>
              <CardDescription>Scan student QR code to check out from venue</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Dialog open={showScanDialog} onOpenChange={(open) => !open && handleBackToMain()}>
          <DialogContent data-testid="dialog-qr-scanner" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {scanMode === "In" ? "Scanning In" : "Scanning Out"}
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
            
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox 
                id="location-confirmed" 
                checked={locationConfirmed} 
                disabled 
                data-testid="checkbox-location-confirmed"
              />
              <Label htmlFor="location-confirmed" className="text-sm">
                Location Confirmed (within 250m of venue)
              </Label>
            </div>
            
            {isCameraActive ? (
              <>
                <QRScanner
                  onScan={handleScannerScan}
                  onError={handleScannerError}
                  isActive={isCameraActive}
                />
                
                <div className="space-y-4 mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Manual Entry</p>
                  <div>
                    <Input
                      id="student-name-input"
                      placeholder="Student ID or Name"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      data-testid="input-student-id"
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
                {lastScanResult && (
                  <Alert className="mb-6">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription data-testid="text-last-scan-result">
                      {lastScanResult}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="flex flex-col items-center gap-3 mb-6">
                  {/* Camera permission handling */}
                  {cameraPermission === 'denied' || cameraPermission === 'unavailable' ? (
                    <>
                      <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <AlertCircle className="w-8 h-8 mx-auto text-orange-500 mb-2" />
                        <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                          {cameraPermission === 'unavailable' 
                            ? "Camera not available on this device" 
                            : "Camera access was denied"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use Manual Entry below to search for students
                        </p>
                      </div>
                      {cameraPermission === 'denied' && (
                        <Button 
                          variant="outline" 
                          onClick={handleRequestCameraAccess}
                          className="mt-2"
                          data-testid="button-retry-camera"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Try Again
                        </Button>
                      )}
                    </>
                  ) : cameraPermission === 'checking' ? (
                    <div className="flex flex-col items-center gap-2 p-4">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <p className="text-sm text-muted-foreground">Requesting camera access...</p>
                    </div>
                  ) : (
                    <>
                      <Button 
                        onClick={handleNextScan} 
                        className="h-32 w-32 rounded-full flex flex-col items-center justify-center gap-2 text-base font-semibold" 
                        data-testid="button-next-scan"
                      >
                        <Camera className="w-8 h-8" />
                        <span>{cameraPermission === 'unknown' ? 'Enable Camera' : 'Next Scan'}</span>
                      </Button>
                      {cameraPermission === 'unknown' && (
                        <p className="text-xs text-muted-foreground text-center">
                          Click to request camera access
                        </p>
                      )}
                    </>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={handleBackToMain}
                    data-testid="button-back-to-main"
                  >
                    Back
                  </Button>
                </div>
                
                <Collapsible 
                  open={isManualEntryOpen || cameraPermission === 'denied' || cameraPermission === 'unavailable'} 
                  onOpenChange={setIsManualEntryOpen}
                >
                  <div className="pt-4 border-t">
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full flex items-center justify-between p-2 hover-elevate"
                        data-testid="button-toggle-manual-entry"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`h-4 w-4 transition-transform ${isManualEntryOpen || cameraPermission === 'denied' || cameraPermission === 'unavailable' ? 'rotate-180' : ''}`} />
                          <span className="text-sm font-medium">Manual Entry</span>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <p className="text-xs text-muted-foreground mb-3">
                        Type student name or ID to search
                      </p>
                      <div className="space-y-3">
                        <Popover open={autocompleteOpen} onOpenChange={setAutocompleteOpen}>
                          <PopoverTrigger asChild>
                            <div className="relative">
                              <Input
                                ref={manualEntryInputRef}
                                id="student-name-input-initial"
                                placeholder="Type student name or ID..."
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
                                          
                                          isProcessingManualSelectionRef.current = true;
                                          
                                          setSelectedStudent(selected);
                                          setQrInput(selected.studentName);
                                          setAutocompleteOpen(false);
                                          setSearchResults([]);
                                          
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

        <Dialog open={showForceDialog} onOpenChange={(open) => !open && handleCancelForceScan()}>
          <DialogContent data-testid="dialog-force-scan">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Warning
              </DialogTitle>
              <DialogDescription>
                {forceScanData?.scanType === "In" 
                  ? `${forceScanData?.studentName} is already checked in at this venue.`
                  : `${forceScanData?.studentName} is not currently at this venue.`
                }
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Do you want to force this scan anyway?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancelForceScan} data-testid="button-cancel-force">
                Cancel
              </Button>
              <Button onClick={handleForceScan} data-testid="button-confirm-force">
                Force {forceScanData?.scanType === "In" ? "Scan In" : "Scan Out"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAtVenueList} onOpenChange={setShowAtVenueList}>
          <DialogContent className="max-w-2xl" data-testid="dialog-at-venue-list">
            <DialogHeader>
              <DialogTitle>Students Currently At Venue</DialogTitle>
              <DialogDescription>
                {session?.venue.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {atVenueData?.data && atVenueData.data.length > 0 ? (
                atVenueData.data.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.school}</p>
                        </div>
                        <Badge>{student.status || "At Venue"}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Alert>
                  <AlertDescription>No students currently at venue</AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showGpsWarning} onOpenChange={setShowGpsWarning}>
          <DialogContent data-testid="dialog-gps-warning">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                GPS Unavailable
              </DialogTitle>
              <DialogDescription>
                Cannot access the GPS function on this device. Location confirmation will not be available, but you can still scan students.
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
                You can close the app without logging out - your session will remain active. Only log out if you're done for the day or switching to a different staff member.
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
      </div>
    </div>
  );
}

export default function VenuePage() {
  return (
    <ErrorBoundary
      fallbackTitle="Venue Portal Unavailable"
      fallbackDescription="This page requires camera and location permissions. Please try on a mobile device or grant permissions in your browser settings."
    >
      <VenuePageContent />
    </ErrorBoundary>
  );
}
