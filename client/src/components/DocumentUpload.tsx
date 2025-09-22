import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useUploadDocuments } from "@/hooks/useDocuments";
import { useClients } from "@/hooks/useClientData";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
}

export function DocumentUpload({ isOpen, onClose, defaultClientId }: DocumentUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClientId || "");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients } = useClients();
  const uploadMutation = useUploadDocuments();

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  };

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
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleUpload = () => {
    if (!selectedFiles) return;

    uploadMutation.mutate(
      { 
        files: selectedFiles, 
        clientId: selectedClientId || undefined 
      },
      {
        onSuccess: () => {
          setSelectedFiles(null);
          setSelectedClientId("");
          onClose();
        },
      }
    );
  };

  const resetForm = () => {
    setSelectedFiles(null);
    setSelectedClientId(defaultClientId || "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-2xl" data-testid="document-upload-modal">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Upload Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              isDragOver ? "border-primary bg-primary/5" : "border-muted",
              "hover:border-primary hover:bg-primary/5"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="file-drop-zone"
          >
            <i className="fas fa-cloud-upload-alt text-4xl text-muted-foreground mb-4"></i>
            <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports PDF, DOCX, DOC, TXT{import.meta.env.VITE_HIPAA_SAFE_AI === 'true' ? ', PNG, JPG' : ''} (max 50MB)
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={import.meta.env.VITE_HIPAA_SAFE_AI === 'true' ? ".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg" : ".pdf,.docx,.doc,.txt"}
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              data-testid="file-input"
            />
          </div>

          {/* Selected Files */}
          {selectedFiles && selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Selected Files:</h3>
              <div className="space-y-1">
                {Array.from(selectedFiles).map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm" data-testid={`selected-file-${index}`}>{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* HIPAA Processing Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <i className="fas fa-info-circle text-blue-600"></i>
              <h3 className="text-sm font-medium text-blue-900">Document Processing Information</h3>
            </div>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>Supported File Types:</strong> PDF, DOCX, DOC, TXT{import.meta.env.VITE_HIPAA_SAFE_AI === 'true' ? ', PNG, JPG' : ''}</p>
              <p><strong>Processing Mode:</strong> {import.meta.env.VITE_HIPAA_SAFE_AI === 'true' ? 'AI-Enhanced Analysis' : 'Basic Deterministic Analysis'}</p>
              <p><strong>Auto-linking:</strong> {import.meta.env.VITE_HIPAA_SAFE_AI === 'true' ? 'Advanced AI Matching' : 'Heuristic-based Matching'}</p>
              {import.meta.env.VITE_HIPAA_SAFE_AI !== 'true' && (
                <p className="text-orange-700">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  <strong>Note:</strong> Image uploads (.png, .jpg) are disabled when HIPAA-safe AI is not enabled
                </p>
              )}
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Associate with Client (optional)</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger data-testid="client-select">
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client: any) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Upload Progress */}
          {uploadMutation.isPending && (
            <div className="space-y-2" data-testid="upload-progress">
              <div className="flex justify-between text-sm">
                <span>Uploading and processing files...</span>
                <span>{import.meta.env.VITE_HIPAA_SAFE_AI === 'true' ? 'AI Analysis' : 'Basic Analysis'}</span>
              </div>
              <Progress value={undefined} className="w-full" />
              <p className="text-xs text-muted-foreground">
                {import.meta.env.VITE_HIPAA_SAFE_AI === 'true' 
                  ? 'Performing AI-enhanced categorization and auto-linking...' 
                  : 'Performing basic categorization and heuristic matching...'
                }
              </p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
              data-testid="cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFiles || selectedFiles.length === 0 || uploadMutation.isPending}
              data-testid="start-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Uploading...
                </>
              ) : (
                <>
                  <i className="fas fa-upload mr-2"></i>
                  Upload Files
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
