import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Plus, Edit, Video, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RecordingRatingDetails } from '../superadmin/RecordingRatingDetails';
import { RecordingAttachmentsManager } from '../superadmin/RecordingAttachmentsManager';
import { safeLogger } from '@/lib/safe-logger';

interface Recording {
  id: string;
  recording_title: string;
  recording_url?: string; // URL not fetched for mentors
  duration_min: number;
  sequence_order: number;
  notes: string;
  description?: string | null;
  assignment_id: string | null;
  module: {
    id: string;
    title: string;
  };
}

interface Module {
  id: string;
  title: string;
}

interface Assignment {
  id: string;
  name: string;
}

export function MentorRecordingsManagement() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    recording_title: '',
    duration_min: 0,
    sequence_order: 0,
    notes: '',
    description: '',
    module_id: '',
    assignment_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRecordings();
    fetchModules();
    fetchAssignments();
  }, []);

  const fetchRecordings = async () => {
    try {
      safeLogger.info('Fetching recordings (mentor view)...');
      // Mentors cannot see recording_url
      const { data, error } = await supabase
        .from('available_lessons')
        .select(`
          id,
          recording_title,
          duration_min,
          sequence_order,
          notes,
          description,
          assignment_id,
          module:modules(id, title)
        `)
        .order('sequence_order');

      if (error) {
        safeLogger.error('Error fetching recordings:', error);
        throw error;
      }
      
      safeLogger.info('Recordings fetched:', { data });
      setRecordings(data || []);
    } catch (error) {
      safeLogger.error('Failed to fetch recordings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch recordings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .order('order');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      safeLogger.error('Error fetching modules:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      safeLogger.error('Error fetching assignments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    safeLogger.info('Form submission started with data:', { formData });
    
    try {
      const recordingData = {
        recording_title: formData.recording_title,
        duration_min: formData.duration_min || null,
        sequence_order: formData.sequence_order || null,
        notes: formData.notes || null,
        description: formData.description || null,
        module: formData.module_id || null,
        assignment_id: formData.assignment_id || null
        // Note: recording_url is NOT included - mentors cannot modify it
      };

      safeLogger.info('Prepared recording data:', { recordingData });

      if (editingRecording) {
        safeLogger.info('Updating recording with ID:', { recordingId: editingRecording.id });
        const { error } = await supabase
          .from('available_lessons')
          .update(recordingData)
          .eq('id', editingRecording.id);

        if (error) {
          safeLogger.error('Update error:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Recording updated successfully"
        });
      } else {
        safeLogger.info('Creating new recording...');
        const { error } = await supabase
          .from('available_lessons')
          .insert(recordingData);

        if (error) {
          safeLogger.error('Insert error:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Recording created successfully"
        });
      }

      setDialogOpen(false);
      setEditingRecording(null);
      setFormData({
        recording_title: '',
        duration_min: 0,
        sequence_order: 0,
        notes: '',
        description: '',
        module_id: '',
        assignment_id: ''
      });
      
      await fetchRecordings();
    } catch (error) {
      safeLogger.error('Error saving recording:', error);
      toast({
        title: "Error",
        description: "Failed to save recording",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (recording: Recording) => {
    setEditingRecording(recording);
    setFormData({
      recording_title: recording.recording_title,
      duration_min: recording.duration_min,
      sequence_order: recording.sequence_order,
      notes: recording.notes,
      description: recording.description || '',
      module_id: recording.module?.id || '',
      assignment_id: recording.assignment_id || ''
    });
    setDialogOpen(true);
  };

  const toggleRecordingExpansion = (recordingId: string) => {
    setExpandedRecordings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordingId)) {
        newSet.delete(recordingId);
      } else {
        newSet.add(recordingId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading recordings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Recordings Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">View and edit video recordings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-4xl h-[85vh] sm:h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingRecording ? 'Edit Recording' : 'Add New Recording'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={formData.recording_title}
                  onChange={(e) => setFormData({ ...formData, recording_title: e.target.value })}
                  placeholder="Enter recording title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              {/* Video URL field is NOT included for mentors */}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.duration_min}
                    onChange={(e) => setFormData({ ...formData, duration_min: parseInt(e.target.value) || 0 })}
                    placeholder="Duration"
                    className="transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sequence Order</label>
                  <Input
                    type="number"
                    value={formData.sequence_order}
                    onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 0 })}
                    placeholder="Order"
                    className="transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Module</label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) => setFormData({ ...formData, module_id: value })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Assignment to Unlock After Watching</label>
                <Select
                  value={formData.assignment_id}
                  onValueChange={(value) => setFormData({ ...formData, assignment_id: value })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select an assignment" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of this recording (visible to students)"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[160px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes or instructions (optional)"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Attachments</label>
                {editingRecording?.id ? (
                  <RecordingAttachmentsManager recordingId={editingRecording.id} />
                ) : (
                  <p className="text-sm text-muted-foreground">Save the recording first to upload attachments.</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  className="hover-scale"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="hover-scale bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                  {editingRecording ? 'Update' : 'Create'} Recording
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-purple-600" />
            All Recordings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recordings.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No recordings found</h3>
              <p className="text-muted-foreground">Create your first recording to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold w-[40%]">Title</TableHead>
                  <TableHead className="font-semibold w-[15%] text-center">Order</TableHead>
                  <TableHead className="font-semibold w-[20%]">Module</TableHead>
                  <TableHead className="font-semibold w-[15%] text-center">Duration</TableHead>
                  <TableHead className="font-semibold w-[10%] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((recording, index) => (
                  <React.Fragment key={recording.id}>
                    <TableRow 
                      className="hover:bg-gray-50 transition-colors animate-fade-in cursor-pointer"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => toggleRecordingExpansion(recording.id)}
                    >
                      <TableCell className="font-medium w-[40%]">
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="p-0 h-8 w-8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRecordingExpansion(recording.id);
                            }}
                          >
                            <ChevronDown 
                              className={`h-4 w-4 transition-transform ${
                                expandedRecordings.has(recording.id) ? 'rotate-180' : ''
                              }`}
                            />
                          </Button>
                          <span className="truncate">{recording.recording_title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-[15%] text-center">
                        <Badge variant="outline" className="font-semibold">{recording.sequence_order || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="w-[20%]">
                        {recording.module ? (
                          <Badge variant="secondary">{recording.module.title}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No module</span>
                        )}
                      </TableCell>
                      <TableCell className="w-[15%] text-center">
                        <span className="font-medium">{recording.duration_min || 'N/A'} min</span>
                      </TableCell>
                      <TableCell className="w-[10%]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(recording);
                            }}
                            className="hover-scale"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRecordings.has(recording.id) && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-gray-50 p-6">
                          <div className="space-y-4">
                            {recording.description && (
                              <div>
                                <h4 className="font-semibold mb-2">Description:</h4>
                                <p className="text-sm text-muted-foreground">{recording.description}</p>
                              </div>
                            )}
                            {recording.notes && (
                              <div>
                                <h4 className="font-semibold mb-2">Notes:</h4>
                                <p className="text-sm text-muted-foreground">{recording.notes}</p>
                              </div>
                            )}
                            <RecordingRatingDetails 
                              recordingId={recording.id} 
                              recordingTitle={recording.recording_title}
                              onDelete={() => {
                                setExpandedRecordings(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(recording.id);
                                  return newSet;
                                });
                                fetchRecordings();
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
