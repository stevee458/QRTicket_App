import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download } from "lucide-react";

interface Student {
  name: string;
  phone: string;
  email: string;
  age: string;
  school: string;
}

interface SuccessPageProps {
  parentName: string;
  students: Array<Student & { id: string; qrCode?: string }>;
  onReset?: () => void;
}

export default function SuccessPage({
  parentName,
  students,
  onReset,
}: SuccessPageProps) {
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    const codes: Record<string, string> = {};
    for (const student of students) {
      if (student.qrCode) {
        codes[student.id] = student.qrCode;
      }
    }
    setQrCodes(codes);
  }, [students]);

  const downloadQRCode = (studentId: string, studentName: string) => {
    const qrCode = qrCodes[studentId];
    if (qrCode) {
      const link = document.createElement("a");
      link.download = `${studentName.replace(/\s+/g, "_")}_QRCode.png`;
      link.href = qrCode;
      link.click();
    }
  };

  const downloadAllQRCodes = () => {
    students.forEach((student) => {
      downloadQRCode(student.id, student.name);
    });
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">
            Registration Successful!
          </h1>
          <p className="text-muted-foreground">
            QR codes have been generated for {parentName}'s students
          </p>
        </div>

        <div className="mb-6 flex justify-center gap-4">
          <Button
            onClick={downloadAllQRCodes}
            data-testid="button-download-all"
          >
            <Download className="h-4 w-4 mr-2" />
            Download All QR Codes
          </Button>
          {onReset && (
            <Button
              variant="outline"
              onClick={onReset}
              data-testid="button-new-registration"
            >
              New Registration
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <Card key={student.id} className="p-6">
              <div className="text-center">
                <h3 className="font-semibold mb-1" data-testid={`text-student-name-${student.id}`}>
                  {student.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {student.school}
                </p>

                {qrCodes[student.id] ? (
                  <div className="mb-4">
                    <img
                      src={qrCodes[student.id]}
                      alt={`QR Code for ${student.name}`}
                      className="mx-auto"
                      data-testid={`img-qr-code-${student.id}`}
                    />
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center mb-4">
                    <p className="text-sm text-muted-foreground">
                      Generating QR code...
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mb-2">
                  ID: {student.id}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Age: {student.age} • {student.email}
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadQRCode(student.id, student.name)}
                  className="w-full"
                  data-testid={`button-download-${student.id}`}
                >
                  <Download className="h-3 w-3 mr-2" />
                  Download
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Important Information</h3>
            <p className="text-sm text-muted-foreground">
              Please save these QR codes. Students will need to present them for
              identification. QR codes can be regenerated for security purposes.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
