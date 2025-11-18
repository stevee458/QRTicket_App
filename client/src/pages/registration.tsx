import { useState } from "react";
import RegistrationForm from "@/components/RegistrationForm";
import SuccessPage from "@/components/SuccessPage";

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
  students: Student[];
}

interface StudentWithId extends Student {
  id: string;
}

export default function Registration() {
  const [registrationData, setRegistrationData] =
    useState<(Omit<RegistrationData, "students"> & { students: StudentWithId[] }) | null>(null);

  const handleSuccess = (data: RegistrationData) => {
    const studentsWithIds = data.students.map((student, index) => ({
      ...student,
      id: `STU-${Date.now()}-${index + 1}`,
    }));

    setRegistrationData({
      parentName: data.parentName,
      parentId: data.parentId,
      parentPhone: data.parentPhone,
      parentEmail: data.parentEmail,
      students: studentsWithIds,
    });
  };

  const handleReset = () => {
    setRegistrationData(null);
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
