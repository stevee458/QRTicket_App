import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StudentStatusIndicatorProps {
  studentId: string;
}

type StudentStatus = "Not Boarded" | "Boarded" | "Alighted";

const statusOptions: StudentStatus[] = ["Not Boarded", "Boarded", "Alighted"];

export function StudentStatusIndicator({ studentId }: StudentStatusIndicatorProps) {
  const { data, isLoading } = useQuery<{ success: boolean; status: StudentStatus }>({
    queryKey: ["/api/students", studentId, "status"],
    queryFn: async () => {
      const response = await fetch(`/api/students/${studentId}/status`);
      if (!response.ok) throw new Error("Failed to fetch student status");
      return await response.json();
    },
    refetchInterval: 30000,
  });

  const currentStatus = data?.status || "Not Boarded";

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground" data-testid={`status-loading-${studentId}`}>
        Loading status...
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid={`status-indicator-${studentId}`}>
      <div className="text-xs font-semibold text-muted-foreground mb-2">Status:</div>
      <div className="flex flex-col gap-1">
        {statusOptions.map((status) => (
          <div
            key={status}
            className="flex items-center gap-2 text-xs"
            data-testid={`status-option-${status.toLowerCase().replace(/\s+/g, "-")}-${studentId}`}
          >
            {currentStatus === status ? (
              <>
                <Check className="w-3 h-3 text-green-600 dark:text-green-500" data-testid={`status-active-${studentId}`} />
                <Badge variant="default" className="text-xs">
                  {status}
                </Badge>
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
  );
}
