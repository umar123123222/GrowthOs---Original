import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BatchTimelineManager } from '@/components/batch/BatchTimelineManager';

export default function BatchTimelinePage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();

  if (!batchId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Batch ID not provided</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Batches
        </Button>
      </div>
      
      <BatchTimelineManager batchId={batchId} />
    </div>
  );
}
