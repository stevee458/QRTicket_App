import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { LogOut, Calendar, AlertTriangle, Download, CheckCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentStatusIndicator } from "@/components/StudentStatusIndicator";

interface Parent {
  id: string;
  name: string;
  email: string;
}

interface Student {
  id: string;
  name: string;
  age: number;
  school: string;
  phone: string;
  email: string;
  qrCode?: string;
  qrCodeCreatedAt?: string;
}

interface QRCode {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  qrCodeData: string;
}

interface Scan {
  id: string;
  scanType: string;
  location: string;
  scannedAt: string;
  driver?: { driverName: string; companyNumber: string };
  vehicle?: { busNumber: string; registrationNumber: string };
  shift?: { shiftTitle: string };
}

export default function Parent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "thisWeek" | "lastWeek" | "thisMonth" | "custom">("thisWeek");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [qrVersionAlert, setQrVersionAlert] = useState<{ studentId: string; studentName: string; currentVersion: number } | null>(null);
  const [studentVersions, setStudentVersions] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: ["/api/parent/session"],
    retry: false,
  });

  const { data: studentsData } = useQuery<any>({
    queryKey: ["/api/parent/students"],
    enabled: !!session,
  });

  useEffect(() => {
    if (!studentsData?.data) return;

    const checkQRVersions = async () => {
      const versions: Record<string, number> = {};
      
      for (const student of studentsData.data) {
        try {
          const response = await fetch(`/api/students/${student.id}/qr-version`);
          const result = await response.json();

          if (result.success && result.data) {
            const currentVersion = result.data.version;
            versions[student.id] = currentVersion;
            
            const storageKey = `qr_version_acknowledged_${student.id}`;
            const acknowledgedVersion = localStorage.getItem(storageKey);

            if (!acknowledgedVersion) {
              if (currentVersion > 1) {
                setQrVersionAlert({
                  studentId: student.id,
                  studentName: student.name,
                  currentVersion: currentVersion,
                });
                break;
              }
              localStorage.setItem(storageKey, currentVersion.toString());
            } else if (parseInt(acknowledgedVersion) !== currentVersion) {
              setQrVersionAlert({
                studentId: student.id,
                studentName: student.name,
                currentVersion: currentVersion,
              });
              break;
            }
          }
        } catch (error) {
          console.error("Error checking QR version:", error);
        }
      }
      
      setStudentVersions(versions);
    };

    checkQRVersions();
  }, [studentsData]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/parent/login", credentials);
      return await response.json();
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["/api/parent/session"], response);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      }, 150);
      toast({
        title: "Login Successful",
        description: "Welcome to the Parent Portal",
      });
    },
    onError: () => {
      toast({
        title: "Login Failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/parent/logout", {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/students"] });
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleDownloadQR = (student: Student, version: number) => {
    if (!student.qrCode) return;

    const link = document.createElement('a');
    link.href = student.qrCode;
    link.download = `QR_${student.name.replace(/\s+/g, '_')}_v${version}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const storageKey = `qr_downloaded_${student.id}_v${version}`;
    localStorage.setItem(storageKey, 'true');

    setStudentVersions(prev => ({ ...prev }));

    toast({
      title: "QR Code Downloaded",
      description: `QR code for ${student.name} (v${version}) has been downloaded`,
    });
  };

  const isQRDownloaded = (studentId: string, version: number): boolean => {
    const storageKey = `qr_downloaded_${studentId}_v${version}`;
    return localStorage.getItem(storageKey) === 'true';
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (dateFilter) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "thisWeek":
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case "lastWeek":
        const lastWeek = subWeeks(now, 1);
        startDate = startOfWeek(lastWeek);
        endDate = endOfWeek(lastWeek);
        break;
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "custom":
        if (!customStartDate || !customEndDate) return null;
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
    }

    return { startDate, endDate };
  };

  const { data: scansData } = useQuery({
    queryKey: ["/api/parent/student", selectedStudent, "scans", dateFilter, customStartDate, customEndDate],
    enabled: !!selectedStudent,
    queryFn: async () => {
      const dateRange = getDateRange();
      if (!dateRange) return { data: [] };

      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      const response = await fetch(`/api/parent/student/${selectedStudent}/scans?${params}`);
      return await response.json();
    },
  });

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Parent Portal Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-parent-login-username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-parent-login-password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-parent-login"
              >
                {loginMutation.isPending ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const students: Student[] = studentsData?.data || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-parent-dashboard-title">
                Parent Portal
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {session.data.name}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-parent-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="students" className="space-y-6">
          <TabsList>
            <TabsTrigger value="students" data-testid="tab-students">My Students</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Trip History</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {students.map((student) => (
                <Card key={student.id} data-testid={`card-student-${student.id}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span data-testid={`text-student-name-${student.id}`}>{student.name}</span>
                      <Badge variant="secondary">{student.school}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Age:</span> {student.age}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span> {student.phone}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span> {student.email}
                      </div>
                    </div>

                    <div>
                      <StudentStatusIndicator studentId={student.id} />
                    </div>

                    {student.qrCode && (
                      <div className="pt-4 border-t">
                        <div className="text-sm font-semibold mb-2">QR Code</div>
                        <div className="flex items-center gap-4">
                          <img
                            src={student.qrCode}
                            alt={`QR Code for ${student.name}`}
                            className="w-32 h-32 border rounded"
                            data-testid={`img-qr-code-${student.id}`}
                          />
                          <div className="flex-1 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Use this QR code for bus boarding/alighting
                            </p>
                            {student.qrCodeCreatedAt && (
                              <p className="text-xs text-muted-foreground">
                                Generated: {format(new Date(student.qrCodeCreatedAt), "PP")}
                              </p>
                            )}
                            {studentVersions[student.id] && (
                              <p className="text-xs text-muted-foreground">
                                Version: {studentVersions[student.id]}
                              </p>
                            )}
                            {studentVersions[student.id] && (
                              <Button
                                size="sm"
                                variant={isQRDownloaded(student.id, studentVersions[student.id]) ? "default" : "destructive"}
                                onClick={() => handleDownloadQR(student, studentVersions[student.id])}
                                className="w-full"
                                data-testid={`button-download-qr-${student.id}`}
                              >
                                {isQRDownloaded(student.id, studentVersions[student.id]) ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    QR Downloaded (v{studentVersions[student.id]})
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download QR Code (v{studentVersions[student.id]})
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {students.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No students registered
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trip History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="student-select">Select Student</Label>
                    <Select value={selectedStudent || ""} onValueChange={setSelectedStudent}>
                      <SelectTrigger id="student-select" data-testid="select-student-history">
                        <SelectValue placeholder="Choose a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="date-filter">Date Range</Label>
                    <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                      <SelectTrigger id="date-filter" data-testid="select-date-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="thisWeek">This Week</SelectItem>
                        <SelectItem value="lastWeek">Last Week</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {dateFilter === "custom" && (
                    <>
                      <div>
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          data-testid="input-start-date"
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          data-testid="input-end-date"
                        />
                      </div>
                    </>
                  )}
                </div>

                {selectedStudent && scansData?.data && (
                  <div className="mt-6 space-y-3">
                    <h3 className="font-semibold">
                      Scans ({scansData.data.length})
                    </h3>
                    {scansData.data.length > 0 ? (
                      <div className="space-y-2">
                        {scansData.data.map((scan: Scan) => (
                          <div
                            key={scan.id}
                            className="p-4 border rounded-lg"
                            data-testid={`card-scan-${scan.id}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={scan.scanType === "On" ? "default" : "secondary"}>
                                  {scan.scanType === "On" ? "Boarded" : "Alighted"}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {format(new Date(scan.scannedAt), "PPp")}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm space-y-1">
                              {scan.driver && (
                                <div className="text-muted-foreground">
                                  Driver: {scan.driver.driverName} ({scan.driver.companyNumber})
                                </div>
                              )}
                              {scan.vehicle && (
                                <div className="text-muted-foreground">
                                  Bus: {scan.vehicle.busNumber} - {scan.vehicle.registrationNumber}
                                </div>
                              )}
                              {scan.shift && (
                                <div className="text-muted-foreground">
                                  Shift: {scan.shift.shiftTitle}
                                </div>
                              )}
                              <div className="text-muted-foreground">
                                Location: {scan.location || "Not available"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No scans found for the selected period
                      </div>
                    )}
                  </div>
                )}

                {!selectedStudent && (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a student to view trip history
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!qrVersionAlert} onOpenChange={() => setQrVersionAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              QR Code Version Changed
            </DialogTitle>
            <DialogDescription>
              The QR code for {qrVersionAlert?.studentName} has been updated to version {qrVersionAlert?.currentVersion}.
              Please print a new QR code for your student.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              if (qrVersionAlert) {
                const storageKey = `qr_version_acknowledged_${qrVersionAlert.studentId}`;
                localStorage.setItem(storageKey, qrVersionAlert.currentVersion.toString());
              }
              setQrVersionAlert(null);
            }}>
              Dismiss
            </Button>
            <Button onClick={() => {
              if (qrVersionAlert) {
                const storageKey = `qr_version_acknowledged_${qrVersionAlert.studentId}`;
                localStorage.setItem(storageKey, qrVersionAlert.currentVersion.toString());
              }
              setQrVersionAlert(null);
              toast({
                title: "QR Code Acknowledged",
                description: "Please print the new QR code",
              });
            }}>
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
