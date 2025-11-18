import SuccessPage from "../SuccessPage";

export default function SuccessPageExample() {
  const mockStudents = [
    {
      id: "STU-001",
      name: "Emma Johnson",
      phone: "+1234567890",
      email: "emma@example.com",
      age: "12",
      school: "Lincoln High School",
    },
    {
      id: "STU-002",
      name: "Noah Johnson",
      phone: "+1234567890",
      email: "noah@example.com",
      age: "15",
      school: "Lincoln High School",
    },
  ];

  return (
    <SuccessPage
      parentName="Sarah Johnson"
      students={mockStudents}
      onReset={() => console.log("Reset clicked")}
    />
  );
}
