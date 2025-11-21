import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Smartphone, Plus, QrCode, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { WhatsappSession } from "@shared/schema";

export default function WhatsAppConnectionsPage() {
  const { toast } = useToast();
  const [showDeviceNameDialog, setShowDeviceNameDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [autoDeleteTimeout, setAutoDeleteTimeout] = useState<NodeJS.Timeout | null>(null);

  const { data: sessions, isLoading } = useQuery<WhatsappSession[]>({
    queryKey: ["/api/whatsapp/sessions"],
    refetchInterval: showQRDialog ? 500 : 30000, // Poll every 30 seconds to keep sessions alive
  });

  // Get the selected session from the list
  const selectedSession = selectedSessionId 
    ? sessions?.find(s => s.id === selectedSessionId) || null 
    : null;


  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/whatsapp/sessions", { deviceName: name });
      return await response.json() as WhatsappSession;
    },
    onSuccess: (session: WhatsappSession) => {
      setShowDeviceNameDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      
      // Auto-open QR dialog after session creation
      setSelectedSessionId(session.id);
      setShowQRDialog(true);
      
      // Show confirmation toast
      toast({
        title: "WhatsApp Session Created",
        description: `Device "${session.deviceName}" is ready. Scan the QR code to connect.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create WhatsApp session",
        variant: "destructive",
      });
    },
  });

  // Monitor connection status - show alert when connected
  useEffect(() => {
    if (!showQRDialog || !selectedSession) return;
    
    if (selectedSession.status === "connected") {
      setShowQRDialog(false);
      toast({
        title: "Successfully Connected!",
        description: `Your WhatsApp account (${selectedSession.phoneNumber}) is now linked and ready to use.`,
      });
    }
  }, [selectedSession, showQRDialog, toast]);

  const disconnectMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("DELETE", `/api/whatsapp/sessions/${sessionId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "WhatsApp session has been disconnected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect session",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-secondary text-secondary-foreground">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="w-3 h-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">WhatsApp Connections</h1>
          <p className="text-muted-foreground mt-2">
            Manage your WhatsApp accounts and connections
          </p>
        </div>
        <Button
          onClick={() => {
            setDeviceName("");
            setShowDeviceNameDialog(true);
          }}
          disabled={createSessionMutation.isPending}
          className="gap-2"
          data-testid="button-create-session"
        >
          <Plus className="w-4 h-4" />
          {createSessionMutation.isPending ? "Creating..." : "Connect Account"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <Card key={session.id} className="hover-elevate" data-testid={`card-session-${session.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-whatsapp/10 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-whatsapp" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {session.phoneNumber || session.deviceName || "Pending"}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {getStatusBadge(session.status)}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>ID: {session.id.substring(0, 8)}...</p>
                  <p>Created: {new Date(session.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  {session.status === "connecting" && session.qrCode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setShowQRDialog(true);
                      }}
                      data-testid={`button-view-qr-${session.id}`}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      View QR
                    </Button>
                  )}
                  {session.status === "connecting" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (confirm("Cancel this connection attempt?")) {
                          disconnectMutation.mutate(session.id);
                        }
                      }}
                      disabled={disconnectMutation.isPending}
                      data-testid={`button-delete-connecting-${session.id}`}
                    >
                      {disconnectMutation.isPending ? "Canceling..." : "Cancel"}
                    </Button>
                  )}
                  {session.status === "connected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => disconnectMutation.mutate(session.id)}
                      disabled={disconnectMutation.isPending}
                      data-testid={`button-disconnect-${session.id}`}
                    >
                      Disconnect
                    </Button>
                  )}
                  {session.status === "disconnected" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (confirm("Delete this session permanently?")) {
                          disconnectMutation.mutate(session.id);
                        }
                      }}
                      disabled={disconnectMutation.isPending}
                      data-testid={`button-delete-session-${session.id}`}
                    >
                      {disconnectMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No WhatsApp Connections</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Connect your first WhatsApp account to start managing conversations and chatbots
            </p>
            <Button
              onClick={() => {
                setDeviceName("");
                setShowDeviceNameDialog(true);
              }}
              disabled={createSessionMutation.isPending}
              className="gap-2"
              data-testid="button-create-first-session"
            >
              <Plus className="w-4 h-4" />
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDeviceNameDialog} onOpenChange={setShowDeviceNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp Account</DialogTitle>
            <DialogDescription>
              Enter a name for this WhatsApp device connection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Device Name</Label>
              <Input
                id="device-name"
                placeholder="e.g., Business Account, Support Team"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                data-testid="input-device-name"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeviceNameDialog(false)}
                className="flex-1"
                data-testid="button-cancel-device-name"
              >
                Cancel
              </Button>
              <Button
                onClick={() => createSessionMutation.mutate(deviceName)}
                disabled={!deviceName.trim() || createSessionMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-device-name"
              >
                {createSessionMutation.isPending ? "Creating..." : "Next"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showQRDialog} onOpenChange={(open) => {
        setShowQRDialog(open);
        if (!open) {
          setSelectedSessionId(null);
          if (autoDeleteTimeout) {
            clearTimeout(autoDeleteTimeout);
            setAutoDeleteTimeout(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Open WhatsApp on your phone and scan this QR code to connect
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {selectedSession?.qrCode ? (
              <div className="bg-white p-6 rounded-lg">
                <img
                  src={selectedSession.qrCode}
                  alt="QR Code"
                  className="w-64 h-64"
                  data-testid="img-qr-code"
                />
              </div>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Waiting for you to scan the QR code...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
