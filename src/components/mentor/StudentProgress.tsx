import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const StudentProgress = ({ students }: { students: any[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Student progress tracking coming soon...</p>
      </CardContent>
    </Card>
  );
};