import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Student {
  id: string;
  name: string;
  email: string;
  lms_access_status: string;
  join_date: string;
}

export const MyStudents = ({ students }: { students: Student[] }) => {
  return (
    <div className="space-y-4">
      {students.map((student) => (
        <Card key={student.id}>
          <CardHeader>
            <CardTitle>{student.name || student.email}</CardTitle>
            <Badge variant="outline">{student.lms_access_status}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Joined: {new Date(student.join_date).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};