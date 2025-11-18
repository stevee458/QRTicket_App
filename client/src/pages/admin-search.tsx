import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit2, Save, X, Loader2, AlertCircle, RefreshCw, Download, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface Parent {
  id: string;
  name: string;
  idNumber: string;
  phone: string;
  email: string;
}

interface Student {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number;
  school: string;
  parentId: string;
  qrCode?: string;
  qrCodeCreatedAt?: Date;
}

interface ParentResult {
  parent: Parent;
  students: Student[];
}

interface StudentResult {
  student: Student;
  parent: Parent;
}

export default function AdminSearch() {
  const [searchType, setSearchType] = useState<"parent" | "student">("parent");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingParent, setEditingParent] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [parentFormData, setParentFormData] = useState<Partial<Parent>>({});
  const [studentFormData, setStudentFormData] = useState<Partial<Student>>({});
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [studentToRegenerate, setStudentToRegenerate] = useState<string | null>(null);
  const [showDeleteParentDialog, setShowDeleteParentDialog] = useState(false);
  const [parentToDelete, setParentToDelete] = useState<string | null>(null);
  const [showDeleteStudentDialog, setShowDeleteStudentDialog] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [siblingCount, setSiblingCount] = useState<number>(0);
  const { toast } = useToast();

  const {
    data: parentResults,
    isLoading: loadingParents,
    error: parentError,
  } = useQuery<{ success: boolean; data: ParentResult[] }>({
    queryKey: ["/api/search/parents", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/search/parents?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search parents");
      return await response.json();
    },
    enabled: searchType === "parent" && searchQuery.length > 0,
  });

  const {
    data: studentResults,
    isLoading: loadingStudents,
    error: studentError,
  } = useQuery<{ success: boolean; data: StudentResult[] }>({
    queryKey: ["/api/search/students", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/search/students?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search students");
      return await response.json();
    },
    enabled: searchType === "student" && searchQuery.length > 0,
  });

  const updateParentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Parent> }) => {
      const response = await apiRequest("PUT", `/api/parent/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/parents"] });
      setEditingParent(null);
      toast({
        title: "Success",
        description: "Parent information updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update parent information",
        variant: "destructive",
      });
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Student> }) => {
      const response = await apiRequest("PUT", `/api/student/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/students"] });
      setEditingStudent(null);
      toast({
        title: "Success",
        description: "Student information updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update student information",
        variant: "destructive",
      });
    },
  });

  const regenerateQRMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const response = await apiRequest("POST", `/api/student/${studentId}/regenerate-qr`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/parents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/search/students"] });
      toast({
        title: "Success",
        description: "QR code regenerated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate QR code",
        variant: "destructive",
      });
    },
  });

  const deleteParentMutation = useMutation({
    mutationFn: async (parentId: string) => {
      const response = await apiRequest("DELETE", `/api/parents/${parentId}`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/parents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/search/students"] });
      toast({
        title: "Success",
        description: "Parent and associated students deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete parent",
        variant: "destructive",
      });
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const response = await apiRequest("DELETE", `/api/students/${studentId}`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/parents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/search/students"] });
      toast({
        title: "Success",
        description: data.deletedParent 
          ? "Student and parent deleted successfully" 
          : "Student deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete student",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchTerm.trim()) {
      setSearchQuery(searchTerm.trim());
    }
  };

  const startEditParent = (parent: Parent) => {
    setEditingParent(parent.id);
    setParentFormData(parent);
  };

  const saveParent = (id: string) => {
    updateParentMutation.mutate({ id, data: parentFormData });
  };

  const startEditStudent = (student: Student) => {
    setEditingStudent(student.id);
    setStudentFormData(student);
  };

  const saveStudent = (id: string) => {
    updateStudentMutation.mutate({ id, data: studentFormData });
  };

  const handleRegenerateClick = (studentId: string) => {
    setStudentToRegenerate(studentId);
    setShowRegenerateDialog(true);
  };

  const confirmRegenerate = () => {
    if (studentToRegenerate) {
      regenerateQRMutation.mutate(studentToRegenerate);
    }
    setShowRegenerateDialog(false);
    setStudentToRegenerate(null);
  };

  const handleDeleteParentClick = (parentId: string) => {
    setParentToDelete(parentId);
    setShowDeleteParentDialog(true);
  };

  const confirmDeleteParent = () => {
    if (parentToDelete) {
      deleteParentMutation.mutate(parentToDelete);
    }
    setShowDeleteParentDialog(false);
    setParentToDelete(null);
  };

  const handleDeleteStudentClick = async (student: Student) => {
    try {
      const response = await fetch(`/api/students/${student.id}/siblings-count`);
      const data = await response.json();
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to check student siblings",
          variant: "destructive",
        });
        return;
      }
      
      if (data.success) {
        setSiblingCount(data.count);
        setStudentToDelete(student);
        setShowDeleteStudentDialog(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check student siblings",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete) {
      deleteStudentMutation.mutate(studentToDelete.id);
    }
    setShowDeleteStudentDialog(false);
    setStudentToDelete(null);
    setSiblingCount(0);
  };

  const copyQRCode = async (qrCode: string, studentName: string) => {
    try {
      const response = await fetch(qrCode);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      toast({
        title: "Success",
        description: `QR code for ${studentName} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy QR code. Please try downloading instead.",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = (qrCode: string, studentName: string) => {
    const link = document.createElement("a");
    link.href = qrCode;
    link.download = `${studentName.replace(/\s+/g, "_")}_QR_Code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Success",
      description: `QR code for ${studentName} downloaded`,
    });
  };

  const formatQRTimestamp = (date: Date | string | undefined) => {
    if (!date) return "N/A";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" data-testid="text-search-title">
          Search & Edit Records
        </h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "parent" | "student")}>
              <TabsList className="mb-4">
                <TabsTrigger value="parent" data-testid="tab-parent">
                  Search by Parent
                </TabsTrigger>
                <TabsTrigger value="student" data-testid="tab-student">
                  Search by Student
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Input
                  placeholder={searchType === "parent" ? "Enter parent name..." : "Enter student name..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-search"
                />
                <Button onClick={handleSearch} data-testid="button-search">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {loadingParents && searchType === "parent" && (
          <Card data-testid="card-loading">
            <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching for parents...
            </CardContent>
          </Card>
        )}

        {loadingStudents && searchType === "student" && (
          <Card data-testid="card-loading">
            <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching for students...
            </CardContent>
          </Card>
        )}

        {parentError && searchType === "parent" && (
          <Alert variant="destructive" data-testid="alert-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to search parents. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {studentError && searchType === "student" && (
          <Alert variant="destructive" data-testid="alert-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to search students. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {searchType === "parent" && parentResults?.data && !loadingParents && (
          <div className="space-y-4">
            {parentResults.data.length === 0 ? (
              <Card data-testid="card-no-results">
                <CardContent className="p-6 text-center text-muted-foreground">
                  No parents found matching "{searchQuery}"
                </CardContent>
              </Card>
            ) : (
              parentResults.data.map((result) => (
                <Card key={result.parent.id} data-testid={`card-parent-${result.parent.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle>Parent: {result.parent.name}</CardTitle>
                    {editingParent === result.parent.id ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveParent(result.parent.id)}
                          disabled={updateParentMutation.isPending}
                          data-testid={`button-save-parent-${result.parent.id}`}
                        >
                          {updateParentMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingParent(null)}
                          data-testid={`button-cancel-edit-parent-${result.parent.id}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditParent(result.parent)}
                          data-testid={`button-edit-parent-${result.parent.id}`}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteParentClick(result.parent.id)}
                          data-testid={`button-delete-parent-${result.parent.id}`}
                        >
                          Delete Parent
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {editingParent === result.parent.id ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="parent-name">Name</Label>
                          <Input
                            id="parent-name"
                            value={parentFormData.name || ""}
                            onChange={(e) => setParentFormData({ ...parentFormData, name: e.target.value })}
                            data-testid="input-parent-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="parent-id">ID Number</Label>
                          <Input
                            id="parent-id"
                            value={parentFormData.idNumber || ""}
                            onChange={(e) => setParentFormData({ ...parentFormData, idNumber: e.target.value })}
                            data-testid="input-parent-id"
                          />
                        </div>
                        <div>
                          <Label htmlFor="parent-phone">Phone</Label>
                          <Input
                            id="parent-phone"
                            value={parentFormData.phone || ""}
                            onChange={(e) => setParentFormData({ ...parentFormData, phone: e.target.value })}
                            data-testid="input-parent-phone"
                          />
                        </div>
                        <div>
                          <Label htmlFor="parent-email">Email</Label>
                          <Input
                            id="parent-email"
                            type="email"
                            value={parentFormData.email || ""}
                            onChange={(e) => setParentFormData({ ...parentFormData, email: e.target.value })}
                            data-testid="input-parent-email"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2 text-sm">
                        <div data-testid={`text-parent-id-${result.parent.id}`}>
                          <span className="text-muted-foreground">ID Number:</span> {result.parent.idNumber}
                        </div>
                        <div data-testid={`text-parent-phone-${result.parent.id}`}>
                          <span className="text-muted-foreground">Phone:</span> {result.parent.phone}
                        </div>
                        <div className="md:col-span-2" data-testid={`text-parent-email-${result.parent.id}`}>
                          <span className="text-muted-foreground">Email:</span> {result.parent.email}
                        </div>
                      </div>
                    )}

                    <div className="mt-6">
                      <h3 className="font-semibold mb-3" data-testid={`text-students-count-${result.parent.id}`}>
                        Students ({result.students.length})
                      </h3>
                      <div className="space-y-3">
                        {result.students.map((student) => (
                          <div
                            key={student.id}
                            className="p-4 border rounded-lg"
                            data-testid={`card-student-${student.id}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium" data-testid={`text-student-name-${student.id}`}>
                                {student.name}
                              </h4>
                              {editingStudent === student.id ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => saveStudent(student.id)}
                                    disabled={updateStudentMutation.isPending}
                                    data-testid={`button-save-student-${student.id}`}
                                  >
                                    {updateStudentMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingStudent(null)}
                                    data-testid={`button-cancel-edit-student-${student.id}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditStudent(student)}
                                  data-testid={`button-edit-student-${student.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            {editingStudent === student.id ? (
                              <>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <Label htmlFor={`student-name-${student.id}`} className="text-xs">
                                      Name
                                    </Label>
                                    <Input
                                      id={`student-name-${student.id}`}
                                      value={studentFormData.name || ""}
                                      onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                                      data-testid="input-student-name"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`student-phone-${student.id}`} className="text-xs">
                                      Phone
                                    </Label>
                                    <Input
                                      id={`student-phone-${student.id}`}
                                      value={studentFormData.phone || ""}
                                      onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                                      data-testid="input-student-phone"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`student-email-${student.id}`} className="text-xs">
                                      Email
                                    </Label>
                                    <Input
                                      id={`student-email-${student.id}`}
                                      type="email"
                                      value={studentFormData.email || ""}
                                      onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
                                      data-testid="input-student-email"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`student-age-${student.id}`} className="text-xs">
                                      Age
                                    </Label>
                                    <Input
                                      id={`student-age-${student.id}`}
                                      type="number"
                                      value={studentFormData.age || ""}
                                      onChange={(e) =>
                                        setStudentFormData({ ...studentFormData, age: parseInt(e.target.value) || 0 })
                                      }
                                      data-testid="input-student-age"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label htmlFor={`student-school-${student.id}`} className="text-xs">
                                      School
                                    </Label>
                                    <Input
                                      id={`student-school-${student.id}`}
                                      value={studentFormData.school || ""}
                                      onChange={(e) =>
                                        setStudentFormData({ ...studentFormData, school: e.target.value })
                                      }
                                      data-testid="input-student-school"
                                    />
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRegenerateClick(student.id)}
                                    disabled={regenerateQRMutation.isPending}
                                    data-testid={`button-regenerate-qr-${student.id}`}
                                  >
                                    {regenerateQRMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    Regenerate QR Code
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div>
                                <div className="grid gap-1 text-sm text-muted-foreground mb-3">
                                  <div data-testid={`text-student-details-${student.id}`}>
                                    Age: {student.age} | School: {student.school}
                                  </div>
                                  <div data-testid={`text-student-phone-${student.id}`}>Phone: {student.phone}</div>
                                  <div data-testid={`text-student-email-${student.id}`}>Email: {student.email}</div>
                                </div>
                                {student.qrCode && (
                                  <div className="mt-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs text-muted-foreground">
                                        QR Code (Active)
                                      </Label>
                                      <span className="text-xs text-muted-foreground" data-testid={`text-qr-timestamp-${student.id}`}>
                                        Created: {formatQRTimestamp(student.qrCodeCreatedAt)}
                                      </span>
                                    </div>
                                    <img
                                      src={student.qrCode}
                                      alt={`QR Code for ${student.name}`}
                                      className="mt-1 border rounded"
                                      data-testid={`img-qr-${student.id}`}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => copyQRCode(student.qrCode!, student.name)}
                                        data-testid={`button-copy-qr-${student.id}`}
                                      >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy QR
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => downloadQRCode(student.qrCode!, student.name)}
                                        data-testid={`button-download-qr-${student.id}`}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download QR
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {searchType === "student" && studentResults?.data && !loadingStudents && (
          <div className="space-y-4">
            {studentResults.data.length === 0 ? (
              <Card data-testid="card-no-results">
                <CardContent className="p-6 text-center text-muted-foreground">
                  No students found matching "{searchQuery}"
                </CardContent>
              </Card>
            ) : (
              studentResults.data.map((result) => (
                <Card key={result.student.id} data-testid={`card-student-result-${result.student.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle>Student: {result.student.name}</CardTitle>
                    {editingStudent === result.student.id ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveStudent(result.student.id)}
                          disabled={updateStudentMutation.isPending}
                          data-testid={`button-save-student-${result.student.id}`}
                        >
                          {updateStudentMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingStudent(null)}
                          data-testid={`button-cancel-edit-student-${result.student.id}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditStudent(result.student)}
                          data-testid={`button-edit-student-${result.student.id}`}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteStudentClick(result.student)}
                          data-testid={`button-delete-student-${result.student.id}`}
                        >
                          Delete Student
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {editingStudent === result.student.id ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 mb-6">
                          <div>
                            <Label htmlFor="result-student-name">Name</Label>
                            <Input
                              id="result-student-name"
                              value={studentFormData.name || ""}
                              onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                              data-testid="input-student-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="result-student-phone">Phone</Label>
                            <Input
                              id="result-student-phone"
                              value={studentFormData.phone || ""}
                              onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                              data-testid="input-student-phone"
                            />
                          </div>
                          <div>
                            <Label htmlFor="result-student-email">Email</Label>
                            <Input
                              id="result-student-email"
                              type="email"
                              value={studentFormData.email || ""}
                              onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
                              data-testid="input-student-email"
                            />
                          </div>
                          <div>
                            <Label htmlFor="result-student-age">Age</Label>
                            <Input
                              id="result-student-age"
                              type="number"
                              value={studentFormData.age || ""}
                              onChange={(e) =>
                                setStudentFormData({ ...studentFormData, age: parseInt(e.target.value) || 0 })
                              }
                              data-testid="input-student-age"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor="result-student-school">School</Label>
                            <Input
                              id="result-student-school"
                              value={studentFormData.school || ""}
                              onChange={(e) => setStudentFormData({ ...studentFormData, school: e.target.value })}
                              data-testid="input-student-school"
                            />
                          </div>
                        </div>
                        {result.student.qrCode && (
                          <div className="mb-6 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">
                                Current QR Code
                              </Label>
                              <span className="text-xs text-muted-foreground" data-testid={`text-qr-timestamp-edit-${result.student.id}`}>
                                Created: {formatQRTimestamp(result.student.qrCodeCreatedAt)}
                              </span>
                            </div>
                            <img
                              src={result.student.qrCode}
                              alt={`QR Code for ${result.student.name}`}
                              className="mt-1 border rounded"
                              data-testid={`img-qr-edit-${result.student.id}`}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRegenerateClick(result.student.id)}
                                disabled={regenerateQRMutation.isPending}
                                data-testid={`button-regenerate-qr-${result.student.id}`}
                              >
                                {regenerateQRMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                )}
                                Regenerate QR Code
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyQRCode(result.student.qrCode!, result.student.name)}
                                data-testid={`button-copy-qr-edit-${result.student.id}`}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Copy QR
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadQRCode(result.student.qrCode!, result.student.name)}
                                data-testid={`button-download-qr-edit-${result.student.id}`}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download QR
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="grid gap-2 md:grid-cols-2 text-sm mb-4">
                          <div data-testid={`text-student-age-${result.student.id}`}>
                            <span className="text-muted-foreground">Age:</span> {result.student.age}
                          </div>
                          <div data-testid={`text-student-school-${result.student.id}`}>
                            <span className="text-muted-foreground">School:</span> {result.student.school}
                          </div>
                          <div data-testid={`text-student-phone-${result.student.id}`}>
                            <span className="text-muted-foreground">Phone:</span> {result.student.phone}
                          </div>
                          <div data-testid={`text-student-email-${result.student.id}`}>
                            <span className="text-muted-foreground">Email:</span> {result.student.email}
                          </div>
                        </div>
                        {result.student.qrCode && (
                          <div className="mb-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">
                                QR Code (Active)
                              </Label>
                              <span className="text-xs text-muted-foreground" data-testid={`text-qr-timestamp-${result.student.id}`}>
                                Created: {formatQRTimestamp(result.student.qrCodeCreatedAt)}
                              </span>
                            </div>
                            <img
                              src={result.student.qrCode}
                              alt={`QR Code for ${result.student.name}`}
                              className="mt-1 border rounded"
                              data-testid={`img-qr-${result.student.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyQRCode(result.student.qrCode!, result.student.name)}
                                data-testid={`button-copy-qr-${result.student.id}`}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Copy QR
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadQRCode(result.student.qrCode!, result.student.name)}
                                data-testid={`button-download-qr-${result.student.id}`}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download QR
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-2" data-testid="text-parent-info-header">
                        Parent Information
                      </h3>
                      <div className="grid gap-2 md:grid-cols-2 text-sm">
                        <div data-testid={`text-parent-name-${result.parent.id}`}>
                          <span className="text-muted-foreground">Name:</span> {result.parent.name}
                        </div>
                        <div data-testid={`text-parent-id-${result.parent.id}`}>
                          <span className="text-muted-foreground">ID Number:</span> {result.parent.idNumber}
                        </div>
                        <div data-testid={`text-parent-phone-${result.parent.id}`}>
                          <span className="text-muted-foreground">Phone:</span> {result.parent.phone}
                        </div>
                        <div data-testid={`text-parent-email-${result.parent.id}`}>
                          <span className="text-muted-foreground">Email:</span> {result.parent.email}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent data-testid="dialog-regenerate-qr">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Regenerate New QR</AlertDialogTitle>
            <AlertDialogDescription>
              Note that the current QR will no longer be active. This action will generate a new QR code
              and deactivate the previous one. Previous QR codes are kept for record purposes (up to 3 old codes).
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-regenerate">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRegenerate}
              data-testid="button-confirm-regenerate"
            >
              Regenerate QR Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteParentDialog} onOpenChange={setShowDeleteParentDialog}>
        <AlertDialogContent data-testid="dialog-delete-parent">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Parent</AlertDialogTitle>
            <AlertDialogDescription>
              Warning: This action will delete the parent and all associated students. 
              This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-parent">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteParent}
              data-testid="button-confirm-delete-parent"
            >
              Delete Parent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteStudentDialog} onOpenChange={setShowDeleteStudentDialog}>
        <AlertDialogContent data-testid="dialog-delete-student">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              {siblingCount > 0 
                ? "The student can be deleted but the associated Parent will remain as there are other Students associated to this parent."
                : "Warning: This action will also delete the associated Parent as this is the only student."}
              {" "}This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-student">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteStudent}
              data-testid="button-confirm-delete-student"
            >
              Delete Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
