import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Users, Calendar, Clock, Settings, AlertTriangle, BookOpen, Route, UserPlus } from 'lucide-react';
import { BatchStudentAssignment } from './BatchStudentAssignment';
import { useBatches, type Batch, type BatchFormData } from '@/hooks/useBatches';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Course {
  id: string;
  title: string;
}

interface Pathway {
  id: string;
  name: string;
}

type EnrollmentType = 'course' | 'pathway';

export function BatchManagement() {
  const { batches, loading, createBatch, updateBatch, deleteBatch, canEditStartDate, fetchBatches } = useBatches();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [studentAssignmentBatch, setStudentAssignmentBatch] = useState<Batch | null>(null);
  const [enrollmentType, setEnrollmentType] = useState<EnrollmentType>('course');
  const [formData, setFormData] = useState<BatchFormData>({
    name: '',
    course_id: '',
    pathway_id: '',
    start_date: '',
    timezone: 'Asia/Karachi',
    default_session_time: '20:00',
    status: 'draft'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCourses();
    fetchPathways();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title')
      .order('title');
    
    if (!error && data) {
      setCourses(data);
    }
  };

  const fetchPathways = async () => {
    const { data, error } = await supabase
      .from('learning_pathways')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (!error && data) {
      setPathways(data);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      course_id: '',
      pathway_id: '',
      start_date: '',
      timezone: 'Asia/Karachi',
      default_session_time: '20:00',
      status: 'draft'
    });
    setEnrollmentType('course');
    setEditingBatch(null);
  };

  const handleOpenDialog = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      const type: EnrollmentType = batch.pathway_id ? 'pathway' : 'course';
      setEnrollmentType(type);
      setFormData({
        name: batch.name,
        course_id: batch.course_id || '',
        pathway_id: batch.pathway_id || '',
        start_date: batch.start_date,
        timezone: batch.timezone,
        default_session_time: batch.default_session_time,
        status: batch.status
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleEnrollmentTypeChange = (value: EnrollmentType) => {
    setEnrollmentType(value);
    // Clear both fields when switching
    setFormData({ ...formData, course_id: '', pathway_id: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare submission data - only include the selected type, use null for empty
    const submissionData = {
      ...formData,
      course_id: enrollmentType === 'course' && formData.course_id ? formData.course_id : null,
      pathway_id: enrollmentType === 'pathway' && formData.pathway_id ? formData.pathway_id : null
    };
    
    try {
      if (editingBatch) {
        // Check if we're trying to change start date on a started batch
        if (!canEditStartDate(editingBatch) && formData.start_date !== editingBatch.start_date) {
          toast({
            title: "Cannot Update",
            description: "Batch start date cannot be changed after it has started.",
            variant: "destructive"
          });
          return;
        }
        await updateBatch(editingBatch.id, submissionData);
      } else {
        await createBatch(submissionData);
      }
      handleCloseDialog();
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this batch? This will also remove all timeline items and unassign students.')) return;
    await deleteBatch(batchId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      case 'draft':
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading batches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            Batch Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">
            Create and manage course batches with scheduled content deployment
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="hover-scale bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingBatch ? 'Edit Batch' : 'Create New Batch'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Batch Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Batch 12 - January 2026"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Enrollment Type *</label>
                <RadioGroup
                  value={enrollmentType}
                  onValueChange={(value) => handleEnrollmentTypeChange(value as EnrollmentType)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="course" id="course" />
                    <Label htmlFor="course" className="flex items-center gap-1.5 cursor-pointer">
                      <BookOpen className="w-4 h-4" />
                      Course
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pathway" id="pathway" />
                    <Label htmlFor="pathway" className="flex items-center gap-1.5 cursor-pointer">
                      <Route className="w-4 h-4" />
                      Pathway
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {enrollmentType === 'course' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Course *</label>
                  <Select
                    value={formData.course_id}
                    onValueChange={(value) => setFormData({ ...formData, course_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Pathway *</label>
                  <Select
                    value={formData.pathway_id}
                    onValueChange={(value) => setFormData({ ...formData, pathway_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a pathway" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {pathways.map((pathway) => (
                        <SelectItem key={pathway.id} value={pathway.id}>
                          {pathway.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date *
                    {editingBatch && !canEditStartDate(editingBatch) && (
                      <span className="text-destructive text-xs ml-2">(locked)</span>
                    )}
                  </label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    disabled={editingBatch !== null && !canEditStartDate(editingBatch)}
                  />
                  {editingBatch && !canEditStartDate(editingBatch) && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Cannot change after batch has started
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Session Time</label>
                  <Input
                    type="time"
                    value={formData.default_session_time}
                    onChange={(e) => setFormData({ ...formData, default_session_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Timezone</label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="Asia/Karachi">Asia/Karachi (PKT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBatch ? 'Update Batch' : 'Create Batch'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Batches Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first batch to start scheduling content deployment
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Batch
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Course / Pathway</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {batch.pathway_id ? (
                          <>
                            <Route className="w-4 h-4 text-muted-foreground" />
                            {batch.pathway?.name || '-'}
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            {batch.course?.title || '-'}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(batch.start_date), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {batch._count?.enrollments || 0}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setStudentAssignmentBatch(batch)}
                          title="Manage Students"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.location.href = `/admin/batches/${batch.id}/timeline`}
                          title="Manage Timeline"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(batch)}
                          title="Edit Batch"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(batch.id)}
                          title="Delete Batch"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Student Assignment Dialog */}
      {studentAssignmentBatch && (
        <BatchStudentAssignment
          batchId={studentAssignmentBatch.id}
          batchName={studentAssignmentBatch.name}
          courseId={studentAssignmentBatch.course_id}
          pathwayId={studentAssignmentBatch.pathway_id}
          open={!!studentAssignmentBatch}
          onOpenChange={(open) => !open && setStudentAssignmentBatch(null)}
          onUpdate={() => fetchBatches()}
        />
      )}
    </div>
  );
}
