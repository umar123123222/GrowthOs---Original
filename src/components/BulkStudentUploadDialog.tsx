import React, { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, FileText, Download, Loader2, CheckCircle, XCircle, 
  AlertTriangle, Users, BookOpen, Route, Trash2 
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useEnhancedStudentCreation } from '@/hooks/useEnhancedStudentCreation'

interface BulkStudentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentsCreated: () => void
}

interface ParsedStudent {
  row: number
  full_name: string
  email: string
  phone: string
  installment_count: number
  enrollment_type: 'course' | 'pathway'
  course_title?: string
  pathway_name?: string
  batch_name?: string
  discount_percentage?: number
  status: 'pending' | 'processing' | 'success' | 'error'
  error?: string
}

interface Course {
  id: string
  title: string
  price: number | null
}

interface Pathway {
  id: string
  name: string
  price: number | null
}

interface Batch {
  id: string
  name: string
  start_date: string
}

export const BulkStudentUploadDialog: React.FC<BulkStudentUploadDialogProps> = ({
  open,
  onOpenChange,
  onStudentsCreated
}) => {
  const { toast } = useToast()
  const { createStudent } = useEnhancedStudentCreation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([])
  const [csvText, setCsvText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [defaultBatchId, setDefaultBatchId] = useState<string>('')
  const [defaultInstallments, setDefaultInstallments] = useState<number>(1)

  // Fetch courses
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-bulk-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, price')
        .eq('is_active', true)
        .order('sequence_order')
      if (error) throw error
      return data as Course[]
    }
  })

  // Fetch pathways
  const { data: pathways = [] } = useQuery({
    queryKey: ['pathways-for-bulk-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_pathways')
        .select('id, name, price')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as Pathway[]
    }
  })

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ['batches-for-bulk-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, start_date')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Batch[]
    }
  })

  // Set default batch when loaded
  React.useEffect(() => {
    if (batches.length > 0 && !defaultBatchId) {
      setDefaultBatchId(batches[0].id)
    }
  }, [batches, defaultBatchId])

  const downloadTemplate = () => {
    const headers = [
      'full_name',
      'email',
      'phone',
      'installment_count',
      'enrollment_type',
      'course_title',
      'pathway_name',
      'batch_name',
      'discount_percentage'
    ]
    const exampleRow = [
      'John Doe',
      'john@example.com',
      '+923001234567',
      '1',
      'course',
      courses[0]?.title || 'Course Title',
      '',
      batches[0]?.name || '',
      '0'
    ]
    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'student_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSV = (text: string): ParsedStudent[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const students: ParsedStudent[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''))
      if (values.length < 3 || !values.some(v => v)) continue
      
      const getVal = (key: string) => {
        const idx = headers.indexOf(key)
        return idx >= 0 ? values[idx] : ''
      }
      
      const enrollmentType = getVal('enrollment_type')?.toLowerCase() === 'pathway' ? 'pathway' : 'course'
      const installments = parseInt(getVal('installment_count')) || defaultInstallments
      const discountPct = parseFloat(getVal('discount_percentage')) || 0
      
      students.push({
        row: i,
        full_name: getVal('full_name') || getVal('name') || getVal('student_name'),
        email: getVal('email'),
        phone: getVal('phone') || getVal('phone_number'),
        installment_count: installments,
        enrollment_type: enrollmentType,
        course_title: getVal('course_title') || getVal('course'),
        pathway_name: getVal('pathway_name') || getVal('pathway'),
        batch_name: getVal('batch_name') || getVal('batch'),
        discount_percentage: discountPct,
        status: 'pending'
      })
    }
    
    return students
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      const parsed = parseCSV(text)
      setParsedStudents(parsed)
    }
    reader.readAsText(file)
  }

  const handleTextParse = () => {
    const parsed = parseCSV(csvText)
    setParsedStudents(parsed)
  }

  const findCourseId = (title: string): string | undefined => {
    if (!title) return courses[0]?.id
    const course = courses.find(c => 
      c.title.toLowerCase() === title.toLowerCase() ||
      c.title.toLowerCase().includes(title.toLowerCase())
    )
    return course?.id
  }

  const findPathwayId = (name: string): string | undefined => {
    if (!name) return pathways[0]?.id
    const pathway = pathways.find(p => 
      p.name.toLowerCase() === name.toLowerCase() ||
      p.name.toLowerCase().includes(name.toLowerCase())
    )
    return pathway?.id
  }

  const findBatchId = (name: string): string | undefined => {
    if (!name) return defaultBatchId || undefined
    const batch = batches.find(b => 
      b.name.toLowerCase() === name.toLowerCase() ||
      b.name.toLowerCase().includes(name.toLowerCase())
    )
    return batch?.id || defaultBatchId || undefined
  }

  const validateStudent = (student: ParsedStudent): string | undefined => {
    if (!student.full_name) return 'Name is required'
    if (!student.email) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) return 'Invalid email format'
    if (!student.phone) return 'Phone is required'
    
    if (student.enrollment_type === 'course') {
      const courseId = findCourseId(student.course_title || '')
      if (!courseId) return `Course "${student.course_title}" not found`
    } else {
      const pathwayId = findPathwayId(student.pathway_name || '')
      if (!pathwayId) return `Pathway "${student.pathway_name}" not found`
    }
    
    return undefined
  }

  const processStudents = async () => {
    setIsProcessing(true)
    setProcessedCount(0)
    setSuccessCount(0)
    setErrorCount(0)
    
    const updatedStudents = [...parsedStudents]
    
    for (let i = 0; i < updatedStudents.length; i++) {
      const student = updatedStudents[i]
      updatedStudents[i] = { ...student, status: 'processing' }
      setParsedStudents([...updatedStudents])
      
      // Validate
      const validationError = validateStudent(student)
      if (validationError) {
        updatedStudents[i] = { ...student, status: 'error', error: validationError }
        setParsedStudents([...updatedStudents])
        setProcessedCount(i + 1)
        setErrorCount(prev => prev + 1)
        continue
      }
      
      // Prepare data
      const courseId = student.enrollment_type === 'course' 
        ? findCourseId(student.course_title || '') 
        : undefined
      const pathwayId = student.enrollment_type === 'pathway' 
        ? findPathwayId(student.pathway_name || '') 
        : undefined
      const batchId = findBatchId(student.batch_name || '')
      
      // Get price for discount calculation
      let totalFee = 0
      if (courseId) {
        const course = courses.find(c => c.id === courseId)
        totalFee = course?.price || 0
      } else if (pathwayId) {
        const pathway = pathways.find(p => p.id === pathwayId)
        totalFee = pathway?.price || 0
      }
      
      try {
        const result = await createStudent({
          full_name: student.full_name,
          email: student.email,
          phone: student.phone,
          installment_count: student.installment_count,
          course_id: courseId,
          pathway_id: pathwayId,
          batch_id: batchId,
          total_fee_amount: totalFee,
          discount_percentage: student.discount_percentage || 0
        })
        
        if (result.success) {
          updatedStudents[i] = { ...student, status: 'success' }
          setSuccessCount(prev => prev + 1)
        } else {
          updatedStudents[i] = { 
            ...student, 
            status: 'error', 
            error: result.error || 'Unknown error' 
          }
          setErrorCount(prev => prev + 1)
        }
      } catch (err: any) {
        updatedStudents[i] = { 
          ...student, 
          status: 'error', 
          error: err.message || 'Failed to create student' 
        }
        setErrorCount(prev => prev + 1)
      }
      
      setParsedStudents([...updatedStudents])
      setProcessedCount(i + 1)
      
      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    setIsProcessing(false)
    
    if (successCount > 0) {
      toast({
        title: 'Bulk Import Complete',
        description: `Created ${successCount} students. ${errorCount} failed.`
      })
      onStudentsCreated()
    }
  }

  const removeStudent = (index: number) => {
    setParsedStudents(prev => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setParsedStudents([])
    setCsvText('')
    setProcessedCount(0)
    setSuccessCount(0)
    setErrorCount(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pendingCount = parsedStudents.filter(s => s.status === 'pending').length
  const hasErrors = parsedStudents.some(s => validateStudent(s))

  return (
    <Dialog open={open} onOpenChange={(open) => !isProcessing && onOpenChange(open)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Student Upload
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="upload" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </TabsTrigger>
            <TabsTrigger value="paste">
              <FileText className="h-4 w-4 mr-2" />
              Paste Data
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="flex-1 overflow-hidden">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Upload CSV File</CardTitle>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 hover:border-primary/50 transition-colors">
                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                  <Label htmlFor="csv-upload" className="cursor-pointer text-center">
                    <span className="text-primary font-medium">Click to upload</span>
                    <span className="text-muted-foreground"> or drag and drop</span>
                    <p className="text-xs text-muted-foreground mt-1">CSV file with student data</p>
                  </Label>
                  <Input
                    ref={fileInputRef}
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Batch</Label>
                    <Select value={defaultBatchId} onValueChange={setDefaultBatchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select default batch" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        <SelectItem value="">No Batch</SelectItem>
                        {batches.map(batch => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Installments</Label>
                    <Select 
                      value={defaultInstallments.toString()} 
                      onValueChange={(v) => setDefaultInstallments(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} {n === 1 ? 'Installment' : 'Installments'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="paste" className="flex-1 overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Paste CSV Data</CardTitle>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <Textarea
                  placeholder="Paste CSV data here... (first row should be headers)"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="min-h-[150px] font-mono text-xs"
                />
                <Button onClick={handleTextParse} disabled={!csvText.trim()}>
                  Parse Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Preview Section */}
        {parsedStudents.length > 0 && (
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-medium">Preview ({parsedStudents.length} students)</h3>
                {isProcessing && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Processing {processedCount}/{parsedStudents.length}...
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {successCount > 0 && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {successCount} Success
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} Failed
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearAll} disabled={isProcessing}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
            
            {isProcessing && (
              <Progress value={(processedCount / parsedStudents.length) * 100} />
            )}
            
            <ScrollArea className="h-[200px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Enrollment</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedStudents.map((student, idx) => {
                    const validationError = validateStudent(student)
                    return (
                      <TableRow key={idx} className={validationError && student.status === 'pending' ? 'bg-yellow-50' : ''}>
                        <TableCell>{student.row}</TableCell>
                        <TableCell className="font-medium">{student.full_name || '-'}</TableCell>
                        <TableCell>{student.email || '-'}</TableCell>
                        <TableCell>{student.phone || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {student.enrollment_type === 'course' ? (
                              <BookOpen className="h-3 w-3" />
                            ) : (
                              <Route className="h-3 w-3" />
                            )}
                            <span className="text-xs truncate max-w-[120px]">
                              {student.course_title || student.pathway_name || 'Default'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.status === 'pending' && validationError ? (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Invalid
                            </Badge>
                          ) : student.status === 'pending' ? (
                            <Badge variant="outline">Pending</Badge>
                          ) : student.status === 'processing' ? (
                            <Badge variant="outline">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing
                            </Badge>
                          ) : student.status === 'success' ? (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Done
                            </Badge>
                          ) : (
                            <Badge variant="destructive" title={student.error}>
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStudent(idx)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            
            {/* Show validation errors */}
            {parsedStudents.some(s => s.status === 'pending' && validateStudent(s)) && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Some entries have validation issues:
                </p>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {parsedStudents
                    .filter(s => s.status === 'pending' && validateStudent(s))
                    .slice(0, 5)
                    .map((s, i) => (
                      <li key={i}>Row {s.row}: {validateStudent(s)}</li>
                    ))}
                  {parsedStudents.filter(s => s.status === 'pending' && validateStudent(s)).length > 5 && (
                    <li>...and {parsedStudents.filter(s => s.status === 'pending' && validateStudent(s)).length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={processStudents}
            disabled={isProcessing || pendingCount === 0}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {pendingCount} Student{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
