import { useState } from "react";
import RegistrationForm from "@/components/RegistrationForm";
import SuccessPage from "@/components/SuccessPage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Student {
  name: string;
  phone: string;
  email: string;
  age: string;
  school: string;
}

interface RegistrationData {
  parentName: string;
  parentId: string;
  parentPhone: string;
  parentEmail: string;
  username: string;
  password: string;
  students: Student[];
}

interface StudentWithId extends Student {
  id: string;
  qrCode: string;
}

interface RegistrationResponse {
  success: boolean;
  data: {
    parent: {
      id: string;
      name: string;
      idNumber: string;
      phone: string;
      email: string;
    };
    students: Array<{
      id: string;
      name: string;
      phone: string;
      email: string;
      age: number;
      school: string;
      qrCode: string;
    }>;
  };
}

export default function Registration() {
  const [registrationData, setRegistrationData] =
    useState<(Omit<RegistrationData, "students"> & { students: StudentWithId[] }) | null>(null);
  const { toast } = useToast();

  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationData) => {
      const response = await apiRequest("POST", "/api/register", data);
      return await response.json() as RegistrationResponse;
    },
    onSuccess: (response) => {
      if (response.success) {
        const studentsWithQRCodes = response.data.students.map((student) => ({
          name: student.name,
          phone: student.phone,
          email: student.email,
          age: student.age.toString(),
          school: student.school,
          id: student.id,
          qrCode: student.qrCode,
        }));

        setRegistrationData({
          parentName: response.data.parent.name,
          parentId: response.data.parent.idNumber,
          parentPhone: response.data.parent.phone,
          parentEmail: response.data.parent.email,
          username: "",
          password: "",
          students: studentsWithQRCodes,
        });

        toast({
          title: "Registration Successful",
          description: `Successfully registered ${response.data.students.length} student(s)`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive",
      });
    },
  });

  const handleSuccess = (data: RegistrationData) => {
    registerMutation.mutate(data);
  };

  const handleReset = () => {
    setRegistrationData(null);
    registerMutation.reset();
  };

  if (registrationData) {
    return (
      <SuccessPage
        parentName={registrationData.parentName}
        students={registrationData.students}
        onReset={handleReset}
      />
    );
  }

  return <RegistrationForm onSuccess={handleSuccess} />;
}
