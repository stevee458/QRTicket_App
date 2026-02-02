import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Bus, MapPin, Activity, Search, ArrowRight, Clock, User } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from "date-fns";
import { StudentStatusIndicator } from "@/components/StudentStatusIndicator";

interface DashboardStats {
  totalStudents: number;
  totalParents: number;
  studentsOnBuses: number;
  studentsAtVenues: number;
  todayScans: number;
}

interface ActiveStudent {
  student: {
    id: string;
    name: string;
    school: string;
  };
  locationType: "bus" | "venue";
  locationName: string;
  since: string;
  details?: {
    busNumber?: string;
    shiftTitle?: string;
    driverName?: string;
    venueName?: string;
  };
}

interface RecentActivity {
  id: string;
  studentId: string;
  scanType: string;
  scannedAt: string;
  location: string | null;
  source: "vehicle" | "venue";
  driver?: { id: string; name: string } | null;
  vehicle?: { id: string; busNumber: string } | null;
  shift?: { id: string; title: string } | null;
  venue?: { id: string; name: string } | null;
  staff?: { id: string; name: string } | null;
}

interface Student {
  id: string;
  name: string;
  school: string;
  phone: string;
  email: string;
  dateOfBirth: string;
}

interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Scan {
  id: string;
  studentId: string;
  scanType: string;
  scannedAt: string;
  location: string | null;
  forced: boolean;
  source: "vehicle" | "venue";
  driver?: { id: string; name: string } | null;
  vehicle?: { id: string; busNumber: string } | null;
  shift?: { id: string; title: string } | null;
  venue?: { id: string; name: string } | null;
  staff?: { id: string; name: string } | null;
}

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{ student: Student; parent: Parent } | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "thisWeek" | "lastWeek" | "thisMonth" | "custom">("thisWeek");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const { data: statsData, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/dashboard/stats"],
    refetchInterval: 30000,
  });

  const { data: activeStudentsData, isLoading: activeLoading } = useQuery<any>({
    queryKey: ["/api/admin/dashboard/active-students"],
    refetchInterval: 15000,
  });

  const { data: recentActivityData, isLoading: activityLoading } = useQuery<any>({
    queryKey: ["/api/admin/dashboard/recent-activity"],
    refetchInterval: 10000,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<any>({
    queryKey: ["/api/search/students", searchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/search/students?q=${encodeURIComponent(searchTerm)}`);
      return response.json();
    },
    enabled: searchTerm.length >= 2,
  });

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        return { startDate: todayStart, endDate: now };
      case "thisWeek":
        return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
      case "lastWeek":
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        return { startDate: lastWeekStart, endDate: lastWeekEnd };
      case "thisMonth":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "custom":
        return {
          startDate: customStartDate ? new Date(customStartDate) : new Date(0),
          endDate: customEndDate ? new Date(customEndDate) : now,
        };
      default:
        return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: now };
    }
  };

  const { startDate, endDate } = getDateRange();

  const { data: studentScansData, isLoading: scansLoading } = useQuery<any>({
    queryKey: ["/api/admin/student", selectedStudent?.student.id, "scans", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!selectedStudent) return null;
      const response = await fetch(
        `/api/admin/student/${selectedStudent.student.id}/scans?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      return response.json();
    },
    enabled: !!selectedStudent,
  });

  const stats: DashboardStats = statsData?.data || {
    totalStudents: 0,
    totalParents: 0,
    studentsOnBuses: 0,
    studentsAtVenues: 0,
    todayScans: 0,
  };

  const activeStudents: ActiveStudent[] = activeStudentsData?.data || [];
  const recentActivity: RecentActivity[] = recentActivityData?.data || [];
  const studentScans: Scan[] = studentScansData?.data || [];

  const handleStudentSelect = (result: { student: Student; parent: Parent }) => {
    setSelectedStudent(result);
    setSearchTerm("");
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm");
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "MMM d, HH:mm");
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card className="hover-elevate transition-colors border-l-4 border-l-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-students">
                {statsLoading ? "..." : stats.totalStudents}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-colors border-l-4 border-l-orange-500/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Parents</CardTitle>
              <User className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-parents">
                {statsLoading ? "..." : stats.totalParents}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-colors border-l-4 border-green-500/50 bg-green-50/30 dark:bg-green-950/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">On Buses</CardTitle>
              <Bus className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="stat-on-buses">
                {statsLoading ? "..." : stats.studentsOnBuses}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-colors border-l-4 border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">At Venues</CardTitle>
              <MapPin className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="stat-at-venues">
                {statsLoading ? "..." : stats.studentsAtVenues}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-colors border-l-4 border-l-purple-500/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Today's Scans</CardTitle>
              <Activity className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-today-scans">
                {statsLoading ? "..." : stats.todayScans}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20 shadow-md">
          <CardHeader className="border-b bg-primary/5">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Search className="h-5 w-5" />
              Find Student
            </CardTitle>
            <CardDescription>Search by student name to view their details and trip history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                placeholder="Type student name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-student-search"
              />
              {searchTerm.length >= 2 && searchResults?.data && searchResults.data.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-64 overflow-auto">
                  {searchResults.data.map((result: { student: Student; parent: Parent }) => (
                    <div
                      key={result.student.id}
                      className="p-3 hover-elevate cursor-pointer border-b last:border-b-0"
                      onClick={() => handleStudentSelect(result)}
                      data-testid={`search-result-${result.student.id}`}
                    >
                      <div className="font-medium">{result.student.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.student.school} | Parent: {result.parent.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {searchTerm.length >= 2 && searchLoading && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg p-3">
                  Searching...
                </div>
              )}
              {searchTerm.length >= 2 && !searchLoading && searchResults?.data?.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg p-3 text-muted-foreground">
                  No students found
                </div>
              )}
            </div>

            {selectedStudent && (
              <div className="mt-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedStudent.student.name}</h3>
                    <p className="text-muted-foreground">{selectedStudent.student.school}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)}>
                    Clear
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p><span className="text-muted-foreground">Phone:</span> {selectedStudent.student.phone}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedStudent.student.email}</p>
                    <p><span className="text-muted-foreground">Parent:</span> {selectedStudent.parent.name}</p>
                    <p><span className="text-muted-foreground">Parent Phone:</span> {selectedStudent.parent.phone}</p>
                  </div>
                  <div>
                    <StudentStatusIndicator studentId={selectedStudent.student.id} />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <h4 className="font-medium">Trip History</h4>
                    <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
                      <SelectTrigger className="w-[180px]" data-testid="select-date-filter">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisWeek">This Week</SelectItem>
                        <SelectItem value="lastWeek">Last Week</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                    {dateFilter === "custom" && (
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          data-testid="input-start-date"
                        />
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          data-testid="input-end-date"
                        />
                      </div>
                    )}
                  </div>

                  {scansLoading ? (
                    <p className="text-muted-foreground">Loading trip history...</p>
                  ) : studentScans.length === 0 ? (
                    <p className="text-muted-foreground">No trips found for this period</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {studentScans.map((scan) => (
                        <div
                          key={scan.id}
                          className="flex justify-between items-center p-3 border rounded-lg"
                          data-testid={`trip-${scan.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={scan.source === "vehicle" ? "default" : "secondary"}>
                              {scan.scanType}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium">
                                {scan.source === "vehicle"
                                  ? `Bus ${scan.vehicle?.busNumber || "Unknown"}`
                                  : scan.venue?.name || "Unknown Venue"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {scan.source === "vehicle"
                                  ? `Driver: ${scan.driver?.name || "Unknown"}`
                                  : `Staff: ${scan.staff?.name || "Unknown"}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{formatDateTime(scan.scannedAt)}</p>
                            {scan.location && (
                              <p className="text-xs text-muted-foreground">{scan.location}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Clock className="h-5 w-5" />
                Currently Active Students
              </CardTitle>
              <CardDescription>Students currently on buses or at venues</CardDescription>
            </CardHeader>
            <CardContent>
              {activeLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : activeStudents.length === 0 ? (
                <p className="text-muted-foreground">No students currently active</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {activeStudents.map((item) => (
                    <div
                      key={item.student.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                      data-testid={`active-student-${item.student.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={item.locationType === "bus" ? "default" : "secondary"}>
                          {item.locationType === "bus" ? <Bus className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        </Badge>
                        <div>
                          <p className="font-medium">{item.student.name}</p>
                          <p className="text-xs text-muted-foreground">{item.student.school}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{item.locationName}</p>
                        <p className="text-xs text-muted-foreground">Since {formatTime(item.since)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500 shadow-sm">
            <CardHeader className="bg-purple-500/5">
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest scans across all drivers and venues</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : recentActivity.length === 0 ? (
                <p className="text-muted-foreground">No activity today</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex justify-between items-center p-2 border rounded"
                      data-testid={`activity-${activity.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={activity.source === "vehicle" ? "outline" : "secondary"} className="text-xs">
                          {activity.scanType}
                        </Badge>
                        <span className="text-sm">
                          {activity.source === "vehicle"
                            ? `Bus ${activity.vehicle?.busNumber}`
                            : activity.venue?.name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTime(activity.scannedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-accent-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Link href="/admin/register">
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer flex items-center justify-between">
                  <span>Register Students</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>

              <Link href="/admin/register-transport">
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer flex items-center justify-between">
                  <span>Register Transport</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>

              <Link href="/admin/register-venue">
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer flex items-center justify-between">
                  <span>Register Venue</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>

              <Link href="/admin/search">
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer flex items-center justify-between">
                  <span>Search & Edit</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
