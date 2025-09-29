import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  X,
  Plus
} from 'lucide-react';
import { useUploadDocuments } from '@/hooks/useDocuments';
import { cn } from '@/lib/utils';

interface SessionDocumentUploadProps {
  sessionId: string;
  clientId: string;
  onUploadComplete?: () => void;
  className?: string;
}

export function SessionDocumentUpload({ sessionId, clientId, onUploadComplete, className }: SessionDocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadMutation = useUploadDocuments();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const fileList = new DataTransfer();
    selectedFiles.forEach(file => fileList.items.add(file));

    try {
      await uploadMutation.mutateAsync({
        files: fileList.files,
        clientId,
        sessionId
      });
      
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={cn("w-full", className)} data-testid="session-document-upload">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="w-5 h-5" />
          <span>Upload Documents to Session</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            isDragOver ? "border-blue-500 bg-blue-50" : "border-muted-foreground/25",
            "hover:border-muted-foreground/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="upload-dropzone"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Drop files here or <Button 
                  variant="link" 
                  className="p-0 h-auto text-blue-600"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="select-files-button"
                >
                  browse files
                </Button>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports PDF, DOCX, DOC, TXT files
              </p>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input"
        />

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Selected Files ({selectedFiles.length})</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  data-testid={`selected-file-${index}`}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="flex-shrink-0"
                    data-testid={`remove-file-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploadMutation.isPending && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Uploading and processing documents...</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* Upload Error */}
        {uploadMutation.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Upload failed: {uploadMutation.error?.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Button */}
        <div className="flex justify-end space-x-2">
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
            className="flex items-center space-x-2"
            data-testid="upload-button"
          >
            {uploadMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'}</span>
              </>
            )}
          </Button>
        </div>

        {/* Upload Notice */}
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Documents uploaded to this session will be automatically processed and linked. 
            Progress notes will be automatically categorized and attached.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}