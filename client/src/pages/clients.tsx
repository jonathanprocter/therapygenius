import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients, useCreateClient } from "@/hooks/useClientData";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Client } from "@shared/schema";

const clientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insuranceId: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const createClient = useCreateClient();
  
  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      insuranceProvider: "",
      insuranceId: "",
    },
  });

  const onSubmit = async (data: ClientFormData) => {
    try {
      const clientData = {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date(data.dateOfBirth),
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        emergencyContact: {
          name: data.emergencyContactName || null,
          phone: data.emergencyContactPhone || null,
          relationship: data.emergencyContactRelationship || null,
        },
        insuranceInfo: {
          provider: data.insuranceProvider || null,
          id: data.insuranceId || null,
        },
      };
      await createClient.mutateAsync(clientData);
      setOpen(false);
      form.reset();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="add-new-client">
          <i className="fas fa-plus mr-2"></i>
          Add New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                data-testid="input-firstName"
                {...form.register("firstName")}
                placeholder="John"
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                data-testid="input-lastName"
                {...form.register("lastName")}
                placeholder="Doe"
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="dateOfBirth">Date of Birth *</Label>
            <Input
              id="dateOfBirth"
              data-testid="input-dateOfBirth"
              type="date"
              {...form.register("dateOfBirth")}
            />
            {form.formState.errors.dateOfBirth && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.dateOfBirth.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                data-testid="input-phone"
                {...form.register("phone")}
                placeholder="555-123-4567"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                {...form.register("email")}
                placeholder="john.doe@email.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              data-testid="input-address"
              {...form.register("address")}
              placeholder="123 Main Street, City, State 12345"
            />
          </div>

          {/* Emergency Contact */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Emergency Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emergencyContactName">Name</Label>
                <Input
                  id="emergencyContactName"
                  data-testid="input-emergencyContactName"
                  {...form.register("emergencyContactName")}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label htmlFor="emergencyContactPhone">Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  data-testid="input-emergencyContactPhone"
                  {...form.register("emergencyContactPhone")}
                  placeholder="555-987-6543"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="emergencyContactRelationship">Relationship</Label>
              <Input
                id="emergencyContactRelationship"
                data-testid="input-emergencyContactRelationship"
                {...form.register("emergencyContactRelationship")}
                placeholder="Spouse"
              />
            </div>
          </div>

          {/* Insurance */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Insurance Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="insuranceProvider">Provider</Label>
                <Input
                  id="insuranceProvider"
                  data-testid="input-insuranceProvider"
                  {...form.register("insuranceProvider")}
                  placeholder="BlueCross BlueShield"
                />
              </div>
              <div>
                <Label htmlFor="insuranceId">Insurance ID</Label>
                <Input
                  id="insuranceId"
                  data-testid="input-insuranceId"
                  {...form.register("insuranceId")}
                  placeholder="BC123456789"
                />
              </div>
            </div>
          </div>


          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createClient.isPending}
              data-testid="button-create-client"
            >
              {createClient.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Creating...
                </>
              ) : (
                "Create Client"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientCard({ client }: { client: Client }) {
  const calculateAge = (dateOfBirth: string | Date | null) => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(client.dateOfBirth);

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`client-card-${client.id}`}>
      <Link href={`/client-chart/${client.id}`}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-medium text-sm" data-testid={`client-initials-${client.id}`}>
                {client.firstName?.[0]}{client.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate" data-testid={`client-name-${client.id}`}>
                {client.firstName} {client.lastName}
              </h3>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                {age && <span>Age: {age}</span>}
                {client.phone && <span>•</span>}
                {client.phone && <span>{client.phone}</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex space-x-1">
              {client.insuranceInfo && (client.insuranceInfo as any).provider && (
                <Badge variant="secondary" className="text-xs">
                  {(client.insuranceInfo as any).provider}
                </Badge>
              )}
            </div>
            <i className="fas fa-chevron-right text-muted-foreground text-xs"></i>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: clients, isLoading } = useClients();

  const filteredClients = (clients as Client[] || []).filter((client: Client) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.firstName?.toLowerCase().includes(searchLower) ||
      client.lastName?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="clients-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="clients-title">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage your client roster and access their charts
          </p>
        </div>
        <AddClientDialog />
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="clients-search"
          className="w-full"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-users text-primary"></i>
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-xl font-semibold" data-testid="total-clients-count">
                  {(clients as Client[] || []).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-user-plus text-green-500"></i>
              <div>
                <p className="text-sm text-muted-foreground">New This Month</p>
                <p className="text-xl font-semibold">
                  {(clients as Client[] || []).filter((c: Client) => {
                    if (!c.createdAt) return false;
                    const created = new Date(c.createdAt);
                    const now = new Date();
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-calendar-check text-blue-500"></i>
              <div>
                <p className="text-sm text-muted-foreground">Active Cases</p>
                <p className="text-xl font-semibold">{(clients as Client[] || []).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <i className="fas fa-users text-4xl text-muted-foreground mb-4"></i>
            <h2 className="text-xl font-semibold mb-2">
              {searchTerm ? "No clients found" : "No clients yet"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Try adjusting your search terms"
                : "Start by adding your first client to the system"
              }
            </p>
            {!searchTerm && <AddClientDialog />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="clients-list">
          {filteredClients.map((client: Client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}