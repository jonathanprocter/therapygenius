import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, TestTube, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface CalendarEventAlias {
  id: string;
  therapistId: string;
  aliasPattern: string;
  matchType: 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  clientId: string;
  isActive: boolean;
  createdFromEventId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

// Form schemas
const aliasFormSchema = z.object({
  aliasPattern: z.string().min(1, "Pattern is required"),
  matchType: z.enum(['exact', 'contains', 'starts_with', 'ends_with', 'regex']),
  clientId: z.string().min(1, "Client is required"),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

const testFormSchema = z.object({
  pattern: z.string().min(1, "Pattern is required"),
  matchType: z.enum(['exact', 'contains', 'starts_with', 'ends_with', 'regex']),
  testText: z.string().min(1, "Test text is required"),
});

type AliasFormData = z.infer<typeof aliasFormSchema>;
type TestFormData = z.infer<typeof testFormSchema>;

export default function CalendarAliases() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<CalendarEventAlias | null>(null);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch aliases
  const { data: aliases = [], isLoading: aliasesLoading } = useQuery({
    queryKey: ["/api/calendar/aliases"],
  });

  // Fetch clients for form dropdown
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Create alias mutation
  const createAliasMutation = useMutation({
    mutationFn: async (data: AliasFormData) => {
      return apiRequest("/api/calendar/aliases", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Alias Created",
        description: "Calendar event alias created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/aliases"] });
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create alias",
        variant: "destructive",
      });
    },
  });

  // Update alias mutation
  const updateAliasMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AliasFormData> }) => {
      return apiRequest(`/api/calendar/aliases/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Alias Updated",
        description: "Calendar event alias updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/aliases"] });
      setEditingAlias(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update alias",
        variant: "destructive",
      });
    },
  });

  // Delete alias mutation
  const deleteAliasMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/calendar/aliases/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Alias Deleted",
        description: "Calendar event alias deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/aliases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete alias",
        variant: "destructive",
      });
    },
  });

  // Test pattern mutation
  const testMutation = useMutation({
    mutationFn: async (data: TestFormData) => {
      return apiRequest("/api/calendar/test-pattern", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test pattern",
        variant: "destructive",
      });
    },
  });

  // Form setup
  const createForm = useForm<AliasFormData>({
    resolver: zodResolver(aliasFormSchema),
    defaultValues: {
      aliasPattern: "",
      matchType: "contains",
      clientId: "",
      isActive: true,
      notes: "",
    },
  });

  const editForm = useForm<AliasFormData>({
    resolver: zodResolver(aliasFormSchema),
  });

  const testForm = useForm<TestFormData>({
    resolver: zodResolver(testFormSchema),
    defaultValues: {
      pattern: "",
      matchType: "contains",
      testText: "",
    },
  });

  // Event handlers
  const onCreateSubmit = (data: AliasFormData) => {
    createAliasMutation.mutate(data);
  };

  const onEditSubmit = (data: AliasFormData) => {
    if (editingAlias) {
      updateAliasMutation.mutate({ id: editingAlias.id, data });
    }
  };

  const onTestSubmit = (data: TestFormData) => {
    testMutation.mutate(data);
  };

  const handleEdit = (alias: CalendarEventAlias) => {
    setEditingAlias(alias);
    editForm.reset({
      aliasPattern: alias.aliasPattern,
      matchType: alias.matchType,
      clientId: alias.clientId,
      isActive: alias.isActive,
      notes: alias.notes || "",
    });
  };

  const handleDelete = (id: string) => {
    deleteAliasMutation.mutate(id);
  };

  if (aliasesLoading || clientsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Calendar Event Aliases</h1>
          <p className="text-muted-foreground">
            Create persistent patterns to automatically match calendar events to clients
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-test-pattern">
                <TestTube className="h-4 w-4 mr-2" />
                Test Pattern
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Test Pattern Matching</DialogTitle>
                <DialogDescription>
                  Test how your pattern will match against different calendar event titles
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={testForm.handleSubmit(onTestSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pattern">Pattern</Label>
                    <Input
                      id="pattern"
                      placeholder="e.g., Sarah Johnson"
                      {...testForm.register("pattern")}
                      data-testid="input-test-pattern"
                    />
                  </div>
                  <div>
                    <Label htmlFor="matchType">Match Type</Label>
                    <Select
                      value={testForm.watch("matchType")}
                      onValueChange={(value) => testForm.setValue("matchType", value as any)}
                    >
                      <SelectTrigger data-testid="select-test-match-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact">Exact Match</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="starts_with">Starts With</SelectItem>
                        <SelectItem value="ends_with">Ends With</SelectItem>
                        <SelectItem value="regex">Regular Expression</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="testText">Test Text</Label>
                  <Input
                    id="testText"
                    placeholder="e.g., Therapy session with Sarah Johnson"
                    {...testForm.register("testText")}
                    data-testid="input-test-text"
                  />
                </div>
                {testResult && (
                  <div className={`p-3 rounded border ${testResult.matches ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {testResult.matches ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">
                        {testResult.matches ? 'Match!' : 'No Match'}
                      </span>
                    </div>
                    {testResult.details && (
                      <p className="text-sm text-muted-foreground mt-1">{testResult.details}</p>
                    )}
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={testMutation.isPending} data-testid="button-run-test">
                    {testMutation.isPending ? "Testing..." : "Test Pattern"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-alias">
                <Plus className="h-4 w-4 mr-2" />
                Create Alias
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Alias</DialogTitle>
                <DialogDescription>
                  Create a pattern to automatically match calendar events to a specific client
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="aliasPattern">Pattern</Label>
                    <Input
                      id="aliasPattern"
                      placeholder="e.g., Sarah Johnson, therapy session"
                      {...createForm.register("aliasPattern")}
                      data-testid="input-create-pattern"
                    />
                    {createForm.formState.errors.aliasPattern && (
                      <p className="text-sm text-destructive mt-1">
                        {createForm.formState.errors.aliasPattern.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="matchType">Match Type</Label>
                    <Select
                      value={createForm.watch("matchType")}
                      onValueChange={(value) => createForm.setValue("matchType", value as any)}
                    >
                      <SelectTrigger data-testid="select-create-match-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact">Exact Match</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="starts_with">Starts With</SelectItem>
                        <SelectItem value="ends_with">Ends With</SelectItem>
                        <SelectItem value="regex">Regular Expression</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="clientId">Client</Label>
                  <Select
                    value={createForm.watch("clientId")}
                    onValueChange={(value) => createForm.setValue("clientId", value)}
                  >
                    <SelectTrigger data-testid="select-create-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: Client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.firstName} {client.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createForm.formState.errors.clientId && (
                    <p className="text-sm text-destructive mt-1">
                      {createForm.formState.errors.clientId.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes about this alias..."
                    {...createForm.register("notes")}
                    data-testid="textarea-create-notes"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={createForm.watch("isActive")}
                    onCheckedChange={(checked) => createForm.setValue("isActive", checked)}
                    data-testid="switch-create-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAliasMutation.isPending} data-testid="button-create-submit">
                    {createAliasMutation.isPending ? "Creating..." : "Create Alias"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Aliases</p>
                <p className="text-2xl font-bold" data-testid="stat-total-aliases">{aliases.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="fas fa-link text-blue-600 text-sm"></i>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Aliases</p>
                <p className="text-2xl font-bold" data-testid="stat-active-aliases">
                  {aliases.filter((alias: CalendarEventAlias) => alias.isActive).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unique Clients</p>
                <p className="text-2xl font-bold" data-testid="stat-unique-clients">
                  {new Set(aliases.map((alias: CalendarEventAlias) => alias.clientId)).size}
                </p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <i className="fas fa-users text-purple-600 text-sm"></i>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aliases List */}
      <div className="space-y-4">
        {aliases.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-link text-muted-foreground text-xl"></i>
              </div>
              <h3 className="text-lg font-medium mb-2">No aliases created yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first alias to automatically match calendar events to clients
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-alias">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Alias
              </Button>
            </CardContent>
          </Card>
        ) : (
          aliases.map((alias: CalendarEventAlias) => (
            <Card key={alias.id} data-testid={`alias-card-${alias.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={alias.isActive ? "default" : "secondary"} data-testid={`badge-status-${alias.id}`}>
                        {alias.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-match-type-${alias.id}`}>
                        {getMatchTypeLabel(alias.matchType)}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-lg mb-1" data-testid={`text-pattern-${alias.id}`}>
                        "{alias.aliasPattern}"
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {getMatchTypeDescription(alias.matchType)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Client: </span>
                        <span className="font-medium" data-testid={`text-client-${alias.id}`}>
                          {alias.client.firstName} {alias.client.lastName}
                        </span>
                      </div>
                      {alias.notes && (
                        <div>
                          <span className="text-sm text-muted-foreground">Notes: </span>
                          <span className="text-sm" data-testid={`text-notes-${alias.id}`}>{alias.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(alias)}
                      data-testid={`button-edit-${alias.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid={`button-delete-${alias.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Alias</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this alias? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(alias.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Alias Dialog */}
      {editingAlias && (
        <Dialog open={!!editingAlias} onOpenChange={() => setEditingAlias(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Alias</DialogTitle>
              <DialogDescription>
                Update the pattern and settings for this alias
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editAliasPattern">Pattern</Label>
                  <Input
                    id="editAliasPattern"
                    {...editForm.register("aliasPattern")}
                    data-testid="input-edit-pattern"
                  />
                  {editForm.formState.errors.aliasPattern && (
                    <p className="text-sm text-destructive mt-1">
                      {editForm.formState.errors.aliasPattern.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="editMatchType">Match Type</Label>
                  <Select
                    value={editForm.watch("matchType")}
                    onValueChange={(value) => editForm.setValue("matchType", value as any)}
                  >
                    <SelectTrigger data-testid="select-edit-match-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="starts_with">Starts With</SelectItem>
                      <SelectItem value="ends_with">Ends With</SelectItem>
                      <SelectItem value="regex">Regular Expression</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="editClientId">Client</Label>
                <Select
                  value={editForm.watch("clientId")}
                  onValueChange={(value) => editForm.setValue("clientId", value)}
                >
                  <SelectTrigger data-testid="select-edit-client">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client: Client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="editNotes">Notes (Optional)</Label>
                <Textarea
                  id="editNotes"
                  {...editForm.register("notes")}
                  data-testid="textarea-edit-notes"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="editIsActive"
                  checked={editForm.watch("isActive")}
                  onCheckedChange={(checked) => editForm.setValue("isActive", checked)}
                  data-testid="switch-edit-active"
                />
                <Label htmlFor="editIsActive">Active</Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAlias(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateAliasMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateAliasMutation.isPending ? "Updating..." : "Update Alias"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function getMatchTypeLabel(matchType: string): string {
  switch (matchType) {
    case 'exact':
      return 'Exact Match';
    case 'contains':
      return 'Contains';
    case 'starts_with':
      return 'Starts With';
    case 'ends_with':
      return 'Ends With';
    case 'regex':
      return 'Regular Expression';
    default:
      return matchType;
  }
}

function getMatchTypeDescription(matchType: string): string {
  switch (matchType) {
    case 'exact':
      return 'Event title must match exactly';
    case 'contains':
      return 'Event title must contain this pattern';
    case 'starts_with':
      return 'Event title must start with this pattern';
    case 'ends_with':
      return 'Event title must end with this pattern';
    case 'regex':
      return 'Event title must match this regular expression';
    default:
      return '';
  }
}