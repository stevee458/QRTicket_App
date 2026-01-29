import { useQuery } from "@tanstack/react-query";
import { Check, MapPin, Bus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface StudentStatusIndicatorProps {
  studentId: string;
}

type TransportStatus = "Not Boarded" | "Boarded" | "Alighted";

const transportStatusOptions: TransportStatus[] = ["Not Boarded", "Boarded", "Alighted"];

interface StatusResponse {
  success: boolean;
  status: TransportStatus;
  scanTime: string | null;
  scanLocation: string | null;
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

  const currentTransportStatus = transportData?.status || "Not Boarded";
  const venueStatus = venueData?.data;
  
  const formatTransportStatusText = (status: TransportStatus): string => {
    if (!transportData?.scanTime) {
      return status;
    }

    const time = format(new Date(transportData.scanTime), "hh:mm a");
    const location = transportData.scanLocation?.includes("GPS:") 
      ? transportData.scanLocation 
      : "No Location data";

    if (status === "Boarded") {
      return `Boarded at ${time} at ${location}`;
    } else if (status === "Alighted") {
      return `Alighted at ${time} at ${location}`;
    } else if (status === "Not Boarded") {
      return `Last Alighted ${time} at ${location}`;
    }

    return status;
  };

  if (isLoadingTransport || isLoadingVenue) {
    return (
      <div className="text-xs text-muted-foreground" data-testid={`status-loading-${studentId}`}>
        Loading status...
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={`status-indicator-${studentId}`}>
      {venueStatus && venueStatus.isAtVenue && venueStatus.venueName && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div className="flex flex-col">
            <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              At Venue: {venueStatus.venueName}
            </Badge>
            {venueStatus.scanTime && (
              <span className="text-xs text-muted-foreground mt-1">
                Since {format(new Date(venueStatus.scanTime), "hh:mm a")}
              </span>
            )}
          </div>
        </div>
      )}

      {venueStatus && !venueStatus.isAtVenue && venueStatus.venueName && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
          <MapPin className="w-4 h-4 text-gray-500" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              Left Venue: {venueStatus.venueName}
            </span>
            {venueStatus.scanTime && (
              <span className="text-xs text-muted-foreground">
                at {format(new Date(venueStatus.scanTime), "hh:mm a")}
              </span>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Bus className="w-3 h-3" />
          Transport Status:
        </div>
        <div className="flex flex-col gap-1">
          {transportStatusOptions.map((status) => (
            <div
              key={status}
              className="flex items-center gap-2 text-xs"
              data-testid={`status-option-${status.toLowerCase().replace(/\s+/g, "-")}-${studentId}`}
            >
              {currentTransportStatus === status ? (
                <>
                  <Check className="w-3 h-3 text-green-600 dark:text-green-500" data-testid={`status-active-${studentId}`} />
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="default" className="text-xs">
                      {status}
                    </Badge>
                    {transportData?.scanTime && (
                      <span className="text-xs text-muted-foreground">
                        {formatTransportStatusText(status)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-3 h-3" />
                  <span className="text-muted-foreground">{status}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
