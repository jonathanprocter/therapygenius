import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link2, Search, User } from "lucide-react";
import type { Document, Client } from "@shared/schema";

interface ManualDocumentLinkingProps {
  document: Document;
  isOpen: boolean;
  onClose: () => void;
}

export function ManualDocumentLinking({ document, isOpen, onClose }: ManualDocumentLinkingProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isOpen,
  });

  const linkMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("POST", `/api/documents/${document.id}/link-client`, { clientId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Document Linked",
        description: `Document successfully linked to client`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/client", data.document.clientId] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Linking Error",
        description: error instanceof Error ? error.message : "Failed to link document to client",
        variant: "destructive",
      });
    },
  });

  const filteredClients = clients?.filter((client) => {
    if (!searchQuery) return true;
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || 
           client.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleLinkClient = (clientId: string) => {
    linkMutation.mutate(clientId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="manual-document-linking-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link Document to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              data-testid="search-clients-input"
            />
          </div>

          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Document:</span> {document.fileName}
            </p>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredClients && filteredClients.length > 0 ? (
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <Card
                    key={client.id}
                    className="hover:border-primary transition-colors"
                    data-testid={`client-card-${client.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base" data-testid={`client-name-${client.id}`}>
                              {client.firstName} {client.lastName}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {client.email && (
                                <p className="text-sm text-muted-foreground truncate" data-testid={`client-email-${client.id}`}>
                                  {client.email}
                                </p>
                              )}
                              {client.phone && (
                                <Badge variant="outline" className="text-xs">
                                  {client.phone}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleLinkClient(client.id)}
                          disabled={linkMutation.isPending}
                          className="ml-4 shrink-0"
                          data-testid={`link-client-button-${client.id}`}
                        >
                          <Link2 className="w-4 h-4 mr-1" />
                          Link
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-clients-message">
                {searchQuery ? "No clients found matching your search" : "No clients available"}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
