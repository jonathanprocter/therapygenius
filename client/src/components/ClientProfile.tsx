import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Client, Assessment } from "@shared/schema";
import { formatDateEastern, calculateAgeEastern } from "@/lib/utils";

interface ClientProfileProps {
  client: Client;
  recentAssessments?: Assessment[];
  className?: string;
}

export function ClientProfile({ client, recentAssessments = [], className }: ClientProfileProps): React.ReactElement {
  // Using Eastern Time utilities for consistent timezone calculations
  const calculateAge = calculateAgeEastern;

  const getLatestScore = (assessmentType: string) => {
    const assessment = recentAssessments
      .filter(a => a.assessmentType === assessmentType)
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())[0];
    
    return assessment?.scores || null;
  };

  const phq9Score = getLatestScore("PHQ-9");
  const gad7Score = getLatestScore("GAD-7");

  const getScoreSeverity = (score: number, type: "PHQ-9" | "GAD-7") => {
    if (type === "PHQ-9") {
      if (score >= 20) return { level: "Severe", color: "bg-red-500" };
      if (score >= 15) return { level: "Moderately Severe", color: "bg-orange-500" };
      if (score >= 10) return { level: "Moderate", color: "bg-yellow-500" };
      if (score >= 5) return { level: "Mild", color: "bg-blue-500" };
      return { level: "Minimal", color: "bg-green-500" };
    } else {
      if (score >= 15) return { level: "Severe", color: "bg-red-500" };
      if (score >= 10) return { level: "Moderate", color: "bg-orange-500" };
      if (score >= 5) return { level: "Mild", color: "bg-yellow-500" };
      return { level: "Minimal", color: "bg-green-500" };
    }
  };

  const age = calculateAge(client.dateOfBirth);

  return (
    <div className={className} data-testid="client-profile">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold text-lg" data-testid="client-initials">
                {client.firstName?.[0]}{client.lastName?.[0]}
              </span>
            </div>
            <div>
              <CardTitle className="text-xl" data-testid="client-full-name">
                {client.firstName} {client.lastName}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {age && <span>Age {age}</span>}
                {client.dateOfBirth && (
                  <span className="ml-2 text-xs">
                    DOB: {formatDateEastern(client.dateOfBirth)} (EST/EDT)
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="font-semibold mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {client.email && (
                <div>
                  <label className="text-muted-foreground">Email</label>
                  <p data-testid="client-email">{client.email}</p>
                </div>
              )}
              {client.phone && (
                <div>
                  <label className="text-muted-foreground">Phone</label>
                  <p data-testid="client-phone">{client.phone}</p>
                </div>
              )}
              {client.address && (
                <div className="md:col-span-2">
                  <label className="text-muted-foreground">Address</label>
                  <p data-testid="client-address">{client.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          {client.emergencyContact && (
            <div>
              <h3 className="font-semibold mb-3">Emergency Contact</h3>
              <div className="text-sm space-y-1" data-testid="emergency-contact">
                {typeof client.emergencyContact === 'object' && client.emergencyContact !== null && (
                  <>
                    {(client.emergencyContact as any).name && (
                      <p><span className="text-muted-foreground">Name:</span> {(client.emergencyContact as any).name}</p>
                    )}
                    {(client.emergencyContact as any).phone && (
                      <p><span className="text-muted-foreground">Phone:</span> {(client.emergencyContact as any).phone}</p>
                    )}
                    {(client.emergencyContact as any).relationship && (
                      <p><span className="text-muted-foreground">Relationship:</span> {(client.emergencyContact as any).relationship}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Assessment Scores */}
          {(phq9Score || gad7Score) && (
            <div>
              <h3 className="font-semibold mb-3">Latest Assessment Scores</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {phq9Score && typeof phq9Score === 'object' && (phq9Score as any).total !== undefined && (
                  <div className="text-center p-4 bg-muted/30 rounded-lg" data-testid="phq9-score">
                    <p className="text-2xl font-bold text-primary">{(phq9Score as any).total}</p>
                    <p className="text-sm text-muted-foreground">PHQ-9 Score</p>
                    <Badge className={getScoreSeverity((phq9Score as any).total, "PHQ-9").color + " text-white mt-1"}>
                      {getScoreSeverity((phq9Score as any).total, "PHQ-9").level}
                    </Badge>
                  </div>
                )}
                
                {gad7Score && typeof gad7Score === 'object' && (gad7Score as any).total !== undefined && (
                  <div className="text-center p-4 bg-muted/30 rounded-lg" data-testid="gad7-score">
                    <p className="text-2xl font-bold text-blue-600">{(gad7Score as any).total}</p>
                    <p className="text-sm text-muted-foreground">GAD-7 Score</p>
                    <Badge className={getScoreSeverity((gad7Score as any).total, "GAD-7").color + " text-white mt-1"}>
                      {getScoreSeverity((gad7Score as any).total, "GAD-7").level}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Insurance Information */}
          {client.insuranceInfo && (
            <div>
              <h3 className="font-semibold mb-3">Insurance Information</h3>
              <div className="text-sm space-y-1" data-testid="insurance-info">
                {typeof client.insuranceInfo === 'object' && client.insuranceInfo !== null && (
                  <>
                    {(client.insuranceInfo as any).provider && (
                      <p><span className="text-muted-foreground">Provider:</span> {(client.insuranceInfo as any).provider}</p>
                    )}
                    {(client.insuranceInfo as any).policyNumber && (
                      <p><span className="text-muted-foreground">Policy Number:</span> {(client.insuranceInfo as any).policyNumber}</p>
                    )}
                    {(client.insuranceInfo as any).groupNumber && (
                      <p><span className="text-muted-foreground">Group Number:</span> {(client.insuranceInfo as any).groupNumber}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
