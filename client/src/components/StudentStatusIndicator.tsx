import { useQuery } from "@tanstack/react-query";
import { MapPin, Bus, Clock } from "lucide-react";
import { format } from "date-fns";

interface StudentStatusIndicatorProps {
  studentId: string;
}

type TransportStatus = "Not Boarded" | "Boarded" | "Alighted";

interface StatusResponse {
  success: boolean;
  status: TransportStatus;
  scanTime: string | null;
  scanLocation: string | null;
  vehicle: { busNumber: string; registrationNumber: string } | null;
  shift: { shiftTitle: string } | null;
  driver: { driverName: string } | null;
}

interface VenueStatusResponse {
  success: boolean;
  data: {
    isAtVenue: boolean;
    venueName: string | null;
    scanTime: string | null;
  } | null;
}

export function StudentStatusIndicator({ studentId }: StudentStatusIndicatorProps) {
  const { data: transportData, isLoading: isLoadingTransport } = useQuery<StatusResponse>({
    queryKey: ["/api/students", studentId, "status"],
    queryFn: async () => {
      const response = await fetch(`/api/students/${studentId}/status`);
      if (!response.ok) throw new Error("Failed to fetch student status");
      return await response.json();
    },
    refetchInterval: 30000,
  });

  const { data: venueData, isLoading: isLoadingVenue } = useQuery<VenueStatusResponse>({
    queryKey: ["/api/students", studentId, "venue-status"],
    queryFn: async () => {
      const response = await fetch(`/api/students/${studentId}/venue-status`);
      if (!response.ok) throw new Error("Failed to fetch venue status");
      return await response.json();
    },
    refetchInterval: 30000,
  });

  if (isLoadingTransport || isLoadingVenue) {
    return (
      <div className="text-xs text-muted-foreground" data-testid={`status-loading-${studentId}`}>
        Loading status...
      </div>
    );
  }

  const currentTransportStatus = transportData?.status || "Not Boarded";
  const venueStatus = venueData?.data;
  const isOnBus = currentTransportStatus === "Boarded";
  const isAtVenue = venueStatus?.isAtVenue && venueStatus?.venueName;

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    return format(new Date(timeStr), "h:mm a");
  };

  return (
    <div className="space-y-2" data-testid={`status-indicator-${studentId}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Current Status
      </div>

      {isOnBus && (
        <div 
          className="p-3 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950"
          data-testid={`status-boarded-${studentId}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Bus className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="font-bold text-green-700 dark:text-green-300 text-lg">
              On Bus
            </span>
          </div>
          <div className="space-y-1 text-sm">
            {transportData?.vehicle && (
              <div className="font-medium text-green-800 dark:text-green-200">
                Bus: {transportData.vehicle.busNumber}
              </div>
            )}
            {transportData?.shift && (
              <div className="text-green-700 dark:text-green-300">
                Shift: {transportData.shift.shiftTitle}
              </div>
            )}
            {transportData?.driver && (
              <div className="text-green-600 dark:text-green-400 text-xs">
                Driver: {transportData.driver.driverName}
              </div>
            )}
            {transportData?.scanTime && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs mt-2">
                <Clock className="w-3 h-3" />
                Boarded at {formatTime(transportData.scanTime)}
              </div>
            )}
            {transportData?.scanLocation && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                <MapPin className="w-3 h-3" />
                {transportData.scanLocation}
              </div>
            )}
          </div>
        </div>
      )}

      {isAtVenue && !isOnBus && (
        <div 
          className="p-3 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950"
          data-testid={`status-venue-${studentId}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-blue-700 dark:text-blue-300 text-lg">
              At Venue
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="font-medium text-blue-800 dark:text-blue-200">
              {venueStatus?.venueName}
            </div>
            {venueStatus?.scanTime && (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs">
                <Clock className="w-3 h-3" />
                Checked in at {formatTime(venueStatus.scanTime)}
              </div>
            )}
          </div>
        </div>
      )}

      {!isOnBus && !isAtVenue && (
        <div 
          className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
          data-testid={`status-not-active-${studentId}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-500" />
            <span className="font-medium text-gray-600 dark:text-gray-400">
              {currentTransportStatus === "Alighted" ? "Alighted" : "Not Currently Active"}
            </span>
          </div>
          {transportData?.scanTime && currentTransportStatus === "Alighted" && (
            <div className="ml-5 mt-2 space-y-1">
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <Clock className="w-3 h-3" />
                Last alighted at {formatTime(transportData.scanTime)}
              </div>
              {transportData?.scanLocation && (
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <MapPin className="w-3 h-3" />
                  {transportData.scanLocation}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
