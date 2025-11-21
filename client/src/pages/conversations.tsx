import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Send, MessageSquare, Phone, Smartphone } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Conversation, Message, WhatsappSession } from "@shared/schema";

export default function ConversationsPage() {
  const { toast } = useToast();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sessions } = useQuery<WhatsappSession[]>({
    queryKey: ["/api/whatsapp/sessions"],
    refetchInterval: 3000,
  });

  const { data: conversations, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations", selectedSession],
    enabled: !!selectedSession,
    refetchInterval: 1000,
    queryFn: async () => {
      const response = await fetch(`/api/conversations?sessionId=${selectedSession}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
  });

  const { data: messages, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
    refetchInterval: 800,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string }) => {
      return await apiRequest("POST", `/api/conversations/${data.conversationId}/messages`, {
        content: data.content,
      });
    },
    onSuccess: () => {
      setMessageText("");
      refetchMessages();
      refetchConversations();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const filteredConversations = conversations?.filter((conv) =>
    conv.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contactNumber.includes(searchQuery)
  ) || [];

  const selectedConvData = conversations?.find((c) => c.id === selectedConversation);
  const sortedMessages = messages ? [...messages].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ) : [];

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation) return;
    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      content: messageText.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Conversations</h1>
        <p className="text-muted-foreground mt-2">
          Manage your WhatsApp conversations in real-time
        </p>
      </div>

      {/* Device Selection */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground block mb-2">
              Select Device
            </label>
            {sessions && sessions.length > 0 ? (
              <Select value={selectedSession || ""} onValueChange={setSelectedSession}>
                <SelectTrigger data-testid="select-device">
                  <SelectValue placeholder="Choose a device..." />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.deviceName || session.phoneNumber || `Device ${session.id.slice(0, 8)}`}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({session.status})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No devices connected. Go to{" "}
                <a href="/whatsapp-connections" className="text-primary hover:underline">
                  WhatsApp Connections
                </a>{" "}
                to add a device.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Main Chat Area */}
      <Card className="overflow-hidden">
        <div className="flex h-[calc(100vh-20rem)]">
          {/* Conversations List */}
          <div className="w-80 border-r border-border flex flex-col bg-muted/30">
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-conversations"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {filteredConversations.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full p-4 flex items-start gap-3 hover:bg-muted transition-colors text-left ${
                        selectedConversation === conv.id ? "bg-muted" : ""
                      }`}
                      data-testid={`button-conversation-${conv.id}`}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {conv.contactName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-foreground truncate">
                            {conv.contactName}
                          </p>
                          {conv.unreadCount > 0 && (
                            <Badge className="bg-primary text-primary-foreground ml-2">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate line-clamp-2">
                          {conv.lastMessage || "No messages yet"}
                        </p>
                        {conv.lastMessageTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(conv.lastMessageTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No conversations found" : "No conversations yet"}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Message View */}
          <div className="flex-1 flex flex-col">
            {selectedConversation && selectedConvData ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border flex items-center gap-3 bg-muted/20">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {selectedConvData.contactName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{selectedConvData.contactName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selectedConvData.contactNumber}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {sortedMessages.length > 0 ? (
                    <div className="space-y-3 flex flex-col">
                      {sortedMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${msg.id}`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.fromMe
                                ? "bg-blue-500 text-white rounded-bl-none"
                                : "bg-gray-200 text-gray-900 rounded-br-none dark:bg-gray-700 dark:text-white"
                            }`}
                          >
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                msg.fromMe ? "text-blue-100" : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">No messages yet. Start the conversation!</p>
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <div className="p-4 border-t border-border bg-muted/20">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sendMessageMutation.isPending}
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
