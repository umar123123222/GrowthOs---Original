
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

  // Show all recordings in the dropdown
  const availableRecordings = recordings;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading modules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Modules Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage course modules and their recordings</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingModule(null);
                setFormData({ title: '', description: '', order: 0, selectedRecordings: [] });
              }}
              className="hover-scale bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingModule ? 'Edit Module' : 'Add New Module'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter module title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter module description"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Order</label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  placeholder="Enter display order"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Assign Recordings</label>
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
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select recordings to assign" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {availableRecordings.map((recording) => {
                      const isCurrentlyAssigned = recording.module && recording.module !== editingModule?.id;
                      return (
                        <SelectItem key={recording.id} value={recording.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{recording.recording_title}</span>
                            {isCurrentlyAssigned && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Assigned
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.selectedRecordings.map((recordingId) => {
                    const recording = recordings.find(r => r.id === recordingId);
                    return (
                      <Badge key={recordingId} variant="secondary" className="animate-scale-in">
                        {recording?.recording_title}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            selectedRecordings: formData.selectedRecordings.filter(id => id !== recordingId)
                          })}
                          className="ml-2 text-xs hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
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
                  {editingModule ? 'Update' : 'Create'} Module
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <BookOpen className="w-6 h-6 mr-3 text-blue-600" />
            All Modules
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {modules.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No modules found</h3>
              <p className="text-muted-foreground">Create your first module to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Order</TableHead>
                  <TableHead className="font-semibold">Recordings</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((module, index) => (
                  <TableRow 
                    key={module.id} 
                    className="hover:bg-gray-50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <TableCell className="font-medium">{module.title}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={module.description}>
                        {module.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{module.order}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {module.recording_count} recordings
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(module)}
                          className="hover-scale hover:bg-blue-50 hover:border-blue-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(module.id)}
                          className="hover-scale hover:bg-red-50 hover:border-red-300 hover:text-red-600"
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
    </div>
  );
}
