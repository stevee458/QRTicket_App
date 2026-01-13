import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Trash2 } from "lucide-react";

const formSchema = z.object({
  parentName: z.string().min(1, "Parent name is required"),
  parentId: z.string().min(1, "Parent ID is required"),
  parentPhone: z.string().min(10, "Valid phone number is required"),
  parentEmail: z.string().email("Valid email is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  students: z.array(
    z.object({
      name: z.string().min(1, "Student name is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      email: z.string().email("Valid email is required"),
      dateOfBirth: z.string().min(1, "Date of birth is required").refine(
        (val) => {
          const date = new Date(val);
          const today = new Date();
          const age = today.getFullYear() - date.getFullYear();
          return !isNaN(date.getTime()) && age >= 5 && age <= 25;
        },
        { message: "Student must be between 5 and 25 years old" }
      ),
      school: z.string().min(1, "School is required"),
    })
  ).min(1, "At least one student is required"),
});

type FormData = z.infer<typeof formSchema>;

interface RegistrationFormProps {
  onSuccess?: (data: FormData) => void;
}

export default function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [studentCount, setStudentCount] = useState(1);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parentName: "",
      parentId: "",
      parentPhone: "",
      parentEmail: "",
      username: "",
      password: "",
      students: [
        {
          name: "",
          phone: "",
          email: "",
          dateOfBirth: "",
          school: "",
        },
      ],
    },
  });

  const addStudent = () => {
    const currentStudents = form.getValues("students");
    const parentPhone = form.getValues("parentPhone");
    const parentEmail = form.getValues("parentEmail");
    
    form.setValue("students", [
      ...currentStudents,
      {
        name: "",
        phone: parentPhone || "",
        email: parentEmail || "",
        dateOfBirth: "",
        school: "",
      },
    ]);
    setStudentCount(studentCount + 1);
  };

  const removeStudent = (index: number) => {
    const currentStudents = form.getValues("students");
    if (currentStudents.length > 1) {
      form.setValue(
        "students",
        currentStudents.filter((_, i) => i !== index)
      );
      setStudentCount(studentCount - 1);
    }
  };

  const onSubmit = (data: FormData) => {
    console.log("Form submitted:", data);
    if (onSuccess) {
      onSuccess(data);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Parent & Student Registration</h1>
          <p className="text-sm text-muted-foreground">
            Complete the form below to register students and receive their QR codes
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Parent Information</h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="parentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter parent's full name"
                          data-testid="input-parent-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Number *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter ID number"
                          data-testid="input-parent-id"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., +1234567890"
                          data-testid="input-parent-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="parent@example.com"
                          data-testid="input-parent-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username (for Parent Portal) *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Choose a username"
                          data-testid="input-parent-username"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (for Parent Portal) *</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Choose a password"
                          data-testid="input-parent-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <div>
              <h2 className="text-xl font-semibold mb-4">Student Details</h2>
              <div className="space-y-4">
                {form.watch("students").map((_, index) => (
                  <Card key={index} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Student {index + 1}</h3>
                      {form.watch("students").length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStudent(index)}
                          data-testid={`button-remove-student-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`students.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter student's name"
                                data-testid={`input-student-name-${index}`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`students.${index}.dateOfBirth`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth *</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                data-testid={`input-student-dob-${index}`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`students.${index}.phone`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Student or parent phone"
                                data-testid={`input-student-phone-${index}`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`students.${index}.email`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="Student or parent email"
                                data-testid={`input-student-email-${index}`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`students.${index}.school`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>School *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter school name"
                                data-testid={`input-student-school-${index}`}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addStudent}
                  className="w-full"
                  data-testid="button-add-student"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Student
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              data-testid="button-submit"
              disabled={form.formState.isSubmitting}
            >
              Complete Registration
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
