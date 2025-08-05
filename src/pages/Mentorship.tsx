import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  MessageSquare, 
  User, 
  Plus,
  Clock,
  Star
} from "lucide-react";

interface Pod {
  id: string;
  name: string;
  notes: string;
  mentor_id: string;
  created_at: string;
  mentor?: {
    full_name: string;
    email: string;
  };
}

interface MentorshipNote {
  id: string;
  note: string;
  added_at: string;
  mentor_id: string;
  student_id: string;
  mentor?: {
    full_name: string;
  };
}

const Mentorship = () => {
  const [userPod, setUserPod] = useState<Pod | null>(null);
  const [podMembers, setPodMembers] = useState<any[]>([]);
  const [mentorshipNotes, setMentorshipNotes] = useState<MentorshipNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUserPod();
    fetchMentorshipNotes();
  }, []);

  const fetchPodMembers = async (podId: string) => {
    try {
      // Since users table doesn't have pod_id, use empty array for now
      const data: any[] = [];

      setPodMembers(data);
    } catch (error) {
      console.error('Error fetching pod members:', error);
    }
  };

  const fetchUserPod = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's pod info
      // Users table doesn't have pod_id field, skip pod fetching for now
      const userData = null;

      if (false) {
        // pods table relationship doesn't exist, skip pod fetching
        setUserPod(null);
        
        // Fetch pod members - skip since podData doesn't exist
      }
    } catch (error) {
      console.error('Error fetching user pod:', error);
    }
  };

  const fetchMentorshipNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // mentorship_notes table doesn't exist, use empty array
      setMentorshipNotes([]);
    } catch (error) {
      console.error('Error fetching mentorship notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !userPod) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // mentorship_notes table doesn't exist, use user_activity_logs instead
      const { error } = await supabase
        .from('user_activity_logs')
        .insert({
          user_id: user.id,
          activity_type: 'mentorship_note',
          metadata: { note: newNote, mentor_id: userPod?.mentor_id }
        });

      if (error) throw error;

      setNewNote("");
      fetchMentorshipNotes();
      
      toast({
        title: "Note Added",
        description: "Your note has been shared with your mentor",
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Study Pod</h1>
        <p className="text-muted-foreground">
          Connect with your pod members and mentor
        </p>
      </div>

      {/* Pod Information */}
      {userPod ? (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Learning Pod: {userPod.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">Mentor: {userPod.mentor?.full_name}</span>
                  <Badge variant="outline">
                    <Star className="w-3 h-3 mr-1" />
                    Mentor
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Contact: {userPod.mentor?.email}
                </p>
                {userPod.notes && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">{userPod.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pod Members */}
            {podMembers.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-3">Pod Members</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {podMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{member.full_name}</div>
                        <div className="text-xs text-gray-500">{member.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Private Forum Embed */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">Pod Discussion Forum</h4>
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <p className="text-gray-600">Private forum embed will be placed here</p>
                <p className="text-sm text-gray-500 mt-1">Contact admin for forum integration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Pod Assigned</h3>
            <p className="text-gray-600">You haven't been assigned to a learning pod yet</p>
          </CardContent>
        </Card>
      )}

      {/* Add New Note */}
      {userPod && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add Mentorship Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Share your progress, challenges, or questions with your mentor..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
            <Button 
              onClick={addNote}
              disabled={!newNote.trim()}
              className="w-full"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send to Mentor
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mentorship Notes History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Pod Conversation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mentorshipNotes.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600">No mentorship notes yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mentorshipNotes.map((note) => (
                <div key={note.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{note.mentor?.full_name || 'Mentor'}</span>
                    <div className="flex items-center gap-1 text-gray-500 text-sm">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(note.added_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-gray-700">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Mentorship;