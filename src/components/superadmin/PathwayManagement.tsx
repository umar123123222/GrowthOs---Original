import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Route, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface LearningPathway {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number | null;
  currency: string | null;
  is_active: boolean;
  is_published: boolean;
  created_at: string | null;
  course_count?: number;
}

interface PathwayCourse {
  id: string;
  pathway_id: string;
  course_id: string;
  step_number: number;
  is_mandatory: boolean;
  is_choice_point: boolean;
  choice_group: number | null;
  course_title?: string;
}

interface Course {
  id: string;
  title: string;
}

export function PathwayManagement() {
  const [pathways, setPathways] = useState<LearningPathway[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [coursesDialogOpen, setCoursesDialogOpen] = useState(false);
  const [editingPathway, setEditingPathway] = useState<LearningPathway | null>(null);
  const [selectedPathway, setSelectedPathway] = useState<LearningPathway | null>(null);
  const [pathwayCourses, setPathwayCourses] = useState<PathwayCourse[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    thumbnail_url: '',
    price: 0,
    currency: 'PKR',
    is_active: true,
    is_published: false
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPathways();
    fetchCourses();
  }, []);

  const fetchPathways = async () => {
    try {
      setLoading(true);
      
      const { data: pathwaysData, error } = await supabase
        .from('learning_pathways')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get course counts per pathway
      const { data: pathwayCoursesData } = await supabase
        .from('pathway_courses')
        .select('pathway_id');

      const courseCountMap = new Map<string, number>();
      pathwayCoursesData?.forEach(pc => {
        courseCountMap.set(pc.pathway_id, (courseCountMap.get(pc.pathway_id) || 0) + 1);
      });

      const pathwaysWithCounts = (pathwaysData || []).map(pathway => ({
        ...pathway,
        course_count: courseCountMap.get(pathway.id) || 0
      }));

      setPathways(pathwaysWithCounts);
    } catch (error) {
      logger.error('Error fetching pathways:', error);
      toast({
        title: "Error",
        description: "Failed to fetch learning pathways",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .eq('is_active', true)
        .order('sequence_order');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      logger.error('Error fetching courses:', error);
    }
  };

  const fetchPathwayCourses = async (pathwayId: string) => {
    try {
      const { data, error } = await supabase
        .from('pathway_courses')
        .select(`
          id,
          pathway_id,
          course_id,
          step_number,
          is_mandatory,
          is_choice_point,
          choice_group,
          courses(title)
        `)
        .eq('pathway_id', pathwayId)
        .order('step_number');

      if (error) throw error;
      
      const coursesWithTitles = (data || []).map(pc => ({
        ...pc,
        course_title: (pc.courses as any)?.title || 'Unknown Course'
      }));
      
      setPathwayCourses(coursesWithTitles);
    } catch (error) {
      logger.error('Error fetching pathway courses:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Pathway name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingPathway) {
        const { error } = await supabase
          .from('learning_pathways')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            price: formData.price,
            currency: formData.currency,
            is_active: formData.is_active,
            is_published: formData.is_published
          })
          .eq('id', editingPathway.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Pathway updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('learning_pathways')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            price: formData.price,
            currency: formData.currency,
            is_active: formData.is_active,
            is_published: formData.is_published
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Pathway created successfully"
        });
      }

      setDialogOpen(false);
      resetForm();
      await fetchPathways();
    } catch (error) {
      logger.error('Error saving pathway:', error);
      toast({
        title: "Error",
        description: "Failed to save pathway",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (pathway: LearningPathway) => {
    setEditingPathway(pathway);
    setFormData({
      name: pathway.name,
      description: pathway.description || '',
      thumbnail_url: pathway.thumbnail_url || '',
      price: pathway.price || 0,
      currency: pathway.currency || 'PKR',
      is_active: pathway.is_active,
      is_published: pathway.is_published
    });
    setDialogOpen(true);
  };

  const handleManageCourses = async (pathway: LearningPathway) => {
    setSelectedPathway(pathway);
    await fetchPathwayCourses(pathway.id);
    setCoursesDialogOpen(true);
  };

  const handleAddCourseToPathway = async (courseId: string) => {
    if (!selectedPathway) return;

    try {
      const nextStep = pathwayCourses.length + 1;
      
      const { error } = await supabase
        .from('pathway_courses')
        .insert({
          pathway_id: selectedPathway.id,
          course_id: courseId,
          step_number: nextStep,
          is_mandatory: true,
          is_choice_point: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Course added to pathway"
      });
      
      await fetchPathwayCourses(selectedPathway.id);
      await fetchPathways();
    } catch (error) {
      logger.error('Error adding course to pathway:', error);
      toast({
        title: "Error",
        description: "Failed to add course",
        variant: "destructive"
      });
    }
  };

  const handleRemoveCourseFromPathway = async (pathwayCourseId: string) => {
    if (!selectedPathway) return;

    try {
      const { error } = await supabase
        .from('pathway_courses')
        .delete()
        .eq('id', pathwayCourseId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Course removed from pathway"
      });
      
      await fetchPathwayCourses(selectedPathway.id);
      await fetchPathways();
    } catch (error) {
      logger.error('Error removing course:', error);
      toast({
        title: "Error",
        description: "Failed to remove course",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (pathwayId: string) => {
    if (!confirm('Are you sure you want to delete this pathway?')) return;

    try {
      // Delete pathway courses first
      await supabase
        .from('pathway_courses')
        .delete()
        .eq('pathway_id', pathwayId);

      const { error } = await supabase
        .from('learning_pathways')
        .delete()
        .eq('id', pathwayId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pathway deleted successfully"
      });
      
      await fetchPathways();
    } catch (error) {
      logger.error('Error deleting pathway:', error);
      toast({
        title: "Error",
        description: "Failed to delete pathway",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingPathway(null);
    setFormData({
      name: '',
      description: '',
      thumbnail_url: '',
      price: 0,
      currency: 'PKR',
      is_active: true,
      is_published: false
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const availableCoursesForPathway = courses.filter(
    c => !pathwayCourses.some(pc => pc.course_id === c.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Learning Pathways</h2>
          <p className="text-muted-foreground">Create structured learning paths with multiple courses</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Pathway
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPathway ? 'Edit Pathway' : 'Create Pathway'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Pathway name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Pathway description"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select 
                    value={formData.currency} 
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_published"
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <Label htmlFor="is_published">Published</Label>
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPathway ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pathways.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <Route className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No learning pathways yet. Create your first pathway to get started.</p>
                  </TableCell>
                </TableRow>
              ) : (
                pathways.map((pathway) => (
                  <TableRow key={pathway.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pathway.name}</p>
                        {pathway.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {pathway.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{pathway.course_count || 0} courses</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {pathway.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {pathway.is_published ? (
                          <Badge className="bg-blue-100 text-blue-800">Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageCourses(pathway)}
                          title="Manage Courses"
                        >
                          <Route className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(pathway)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pathway.id)}
                          className="hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manage Courses Dialog */}
      <Dialog open={coursesDialogOpen} onOpenChange={setCoursesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Courses - {selectedPathway?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current courses in pathway */}
            <div>
              <Label className="text-sm font-medium">Courses in Pathway</Label>
              {pathwayCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No courses added yet.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {pathwayCourses.map((pc, index) => (
                    <div key={pc.id} className="flex items-center gap-1">
                      <Badge variant="secondary" className="flex items-center gap-2">
                        <span className="font-bold">{pc.step_number}.</span>
                        {pc.course_title}
                        <button
                          onClick={() => handleRemoveCourseFromPathway(pc.id)}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                      {index < pathwayCourses.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add course */}
            {availableCoursesForPathway.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Add Course</Label>
                <Select onValueChange={handleAddCourseToPathway}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a course to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoursesForPathway.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCoursesDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
