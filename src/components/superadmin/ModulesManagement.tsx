import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  recording_count: number;
}

interface Recording {
  id: string;
  recording_title: string;
  module: string;
}

export function ModulesManagement() {
  const [modules, setModules] = useState<Module[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    order: 0,
    selectedRecordings: [] as string[]
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchModules();
    fetchRecordings();
  }, []);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select(`
          *,
          available_lessons(count)
        `)
        .order('order');

      if (error) throw error;

      const modulesWithCount = data?.map(module => ({
        ...module,
        recording_count: module.available_lessons?.[0]?.count || 0
      })) || [];

      setModules(modulesWithCount);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch modules",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecordings = async () => {
    try {
      const { data, error } = await supabase
        .from('available_lessons')
        .select('id, recording_title, module')
        .order('sequence_order');

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingModule) {
        const { error } = await supabase
          .from('modules')
          .update({
            title: formData.title,
            description: formData.description,
            order: formData.order
          })
          .eq('id', editingModule.id);

        if (error) throw error;

        // Update recordings module assignment
        if (formData.selectedRecordings.length > 0) {
          await supabase
            .from('available_lessons')
            .update({ module: editingModule.id })
            .in('id', formData.selectedRecordings);
        }

        toast({
          title: "Success",
          description: "Module updated successfully"
        });
      } else {
        const { data: newModule, error } = await supabase
          .from('modules')
          .insert({
            title: formData.title,
            description: formData.description,
            order: formData.order
          })
          .select()
          .single();

        if (error) throw error;

        // Assign selected recordings to new module
        if (formData.selectedRecordings.length > 0 && newModule) {
          await supabase
            .from('available_lessons')
            .update({ module: newModule.id })
            .in('id', formData.selectedRecordings);
        }

        toast({
          title: "Success",
          description: "Module created successfully"
        });
      }

      setDialogOpen(false);
      setEditingModule(null);
      setFormData({ title: '', description: '', order: 0, selectedRecordings: [] });
      fetchModules();
      fetchRecordings();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save module",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (module: Module) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description,
      order: module.order,
      selectedRecordings: []
    });
    setDialogOpen(true);
  };

  const handleDelete = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return;

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Module deleted successfully"
      });
      fetchModules();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete module",
        variant: "destructive"
      });
    }
  };

  const availableRecordings = recordings.filter(r => !r.module || r.module === editingModule?.id);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Modules Management</h2>
          <p className="text-muted-foreground">Manage course modules and their recordings</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingModule(null);
              setFormData({ title: '', description: '', order: 0, selectedRecordings: [] });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingModule ? 'Edit Module' : 'Add New Module'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Order</label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Assign Recordings</label>
                <Select
                  onValueChange={(value) => {
                    if (!formData.selectedRecordings.includes(value)) {
                      setFormData({
                        ...formData,
                        selectedRecordings: [...formData.selectedRecordings, value]
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recordings to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRecordings.map((recording) => (
                      <SelectItem key={recording.id} value={recording.id}>
                        {recording.recording_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.selectedRecordings.map((recordingId) => {
                    const recording = recordings.find(r => r.id === recordingId);
                    return (
                      <Badge key={recordingId} variant="secondary">
                        {recording?.recording_title}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            selectedRecordings: formData.selectedRecordings.filter(id => id !== recordingId)
                          })}
                          className="ml-2 text-xs"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingModule ? 'Update' : 'Create'} Module
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="w-5 h-5 mr-2" />
            All Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Recordings</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell className="font-medium">{module.title}</TableCell>
                  <TableCell className="max-w-xs truncate">{module.description}</TableCell>
                  <TableCell>{module.order}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{module.recording_count} recordings</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(module)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(module.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}