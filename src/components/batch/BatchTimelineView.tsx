import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Video, Radio, Calendar, Clock, Lock, Unlock, Play, 
  CheckCircle, ExternalLink, AlertCircle, FileText
} from 'lucide-react';
import { useBatchTimelineStatus, type TimelineStatusItem, type SessionState } from '@/hooks/useBatchTimelineStatus';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface BatchTimelineViewProps {
  batchId: string;
  batchName?: string;
}

export function BatchTimelineView({ batchId, batchName }: BatchTimelineViewProps) {
  const { timelineStatus, loading, getSessionState } = useBatchTimelineStatus(batchId);
  const navigate = useNavigate();

  const deployedItems = timelineStatus.filter(item => item.is_deployed);
  const unlockedItems = timelineStatus.filter(item => item.is_unlocked);
  const progress = timelineStatus.length > 0 
    ? Math.round((unlockedItems.length / timelineStatus.length) * 100) 
    : 0;

  const handleWatchRecording = (recordingId: string | null, recordingUrl: string | null) => {
    if (recordingId) {
      navigate(`/videos/${recordingId}`);
    } else if (recordingUrl) {
      window.open(recordingUrl, '_blank');
    }
  };

  const handleJoinSession = (meetingLink: string | null) => {
    if (meetingLink) {
      window.open(meetingLink, '_blank');
    }
  };

  const handleWatchSessionRecording = (recordingUrl: string | null) => {
    if (recordingUrl) {
      window.open(recordingUrl, '_blank');
    }
  };

  const getSessionStateUI = (item: TimelineStatusItem) => {
    const state = getSessionState(item);
    
    switch (state) {
      case 'join_now':
        return {
          badge: <Badge className="bg-red-100 text-red-800 animate-pulse">Live Now</Badge>,
          button: (
            <Button onClick={() => handleJoinSession(item.meeting_link)} className="bg-red-500 hover:bg-red-600">
              <ExternalLink className="w-4 h-4 mr-2" />
              Join Now
            </Button>
          )
        };
      case 'watch_now':
        return {
          badge: <Badge className="bg-green-100 text-green-800">Recording Available</Badge>,
          button: (
            <Button onClick={() => handleWatchSessionRecording(item.session_recording_url)} variant="default">
              <Play className="w-4 h-4 mr-2" />
              Watch Recording
            </Button>
          )
        };
      case 'recording_pending':
        return {
          badge: <Badge className="bg-yellow-100 text-yellow-800">Session Ended</Badge>,
          button: (
            <Button disabled variant="outline">
              <Clock className="w-4 h-4 mr-2" />
              Recording Coming Soon
            </Button>
          )
        };
      case 'upcoming':
      default:
        return {
          badge: <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>,
          button: item.start_datetime ? (
            <Button disabled variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              {format(new Date(item.start_datetime), 'MMM dd, h:mm a')}
            </Button>
          ) : null
        };
    }
  };

  const getAssignmentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" /> Needs Resubmission</Badge>;
      default:
        return <Badge variant="outline"><FileText className="w-3 h-3 mr-1" /> Not Submitted</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (timelineStatus.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No Content Available</h3>
          <p className="text-muted-foreground">
            Content will appear here as it becomes available based on the batch schedule.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{batchName || 'Batch Timeline'}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {unlockedItems.length} / {timelineStatus.length} unlocked
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Timeline Items */}
      <div className="space-y-4">
        {timelineStatus.map((item, index) => {
          const isRecording = item.item_type === 'RECORDING';
          const sessionUI = !isRecording ? getSessionStateUI(item) : null;
          
          return (
            <Card 
              key={item.item_id}
              className={`transition-all duration-200 ${
                !item.is_deployed 
                  ? 'opacity-50 border-dashed' 
                  : item.is_unlocked 
                    ? 'hover:shadow-md' 
                    : 'border-l-4 border-l-muted'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-full ${
                    item.is_unlocked 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isRecording ? <Video className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{item.title}</h3>
                          <Badge variant={isRecording ? 'default' : 'secondary'}>
                            {isRecording ? 'Recording' : 'Live Session'}
                          </Badge>
                          {!isRecording && sessionUI?.badge}
                        </div>
                        
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Day {item.drip_offset_days}
                          </span>
                          {item.duration_min && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {item.duration_min} min
                            </span>
                          )}
                          {item.recording_watched && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              Watched
                            </span>
                          )}
                        </div>

                        {/* Assignment Status */}
                        {isRecording && item.assignment_required && (
                          <div className="mt-2">
                            {getAssignmentStatusBadge(item.assignment_status)}
                          </div>
                        )}

                        {/* Lock Reason */}
                        {!item.is_unlocked && item.unlock_reason && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md">
                            <Lock className="w-4 h-4" />
                            {item.unlock_reason}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0">
                        {isRecording ? (
                          item.is_unlocked ? (
                            <Button 
                              onClick={() => handleWatchRecording(item.recording_id, item.recording_url)}
                              variant={item.recording_watched ? 'outline' : 'default'}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              {item.recording_watched ? 'Watch Again' : 'Watch Now'}
                            </Button>
                          ) : (
                            <Button disabled variant="outline">
                              <Lock className="w-4 h-4 mr-2" />
                              Locked
                            </Button>
                          )
                        ) : (
                          item.is_unlocked ? sessionUI?.button : (
                            <Button disabled variant="outline">
                              <Lock className="w-4 h-4 mr-2" />
                              Locked
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
