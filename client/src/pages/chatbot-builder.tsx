import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertChatbotRuleSchema, type ChatbotRule } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bot, Plus, Trash2, Edit, CheckCircle2, XCircle } from "lucide-react";
import { z } from "zod";

const chatbotFormSchema = insertChatbotRuleSchema.extend({
  keyword: z.string().min(1, "Keyword is required"),
  response: z.string().min(1, "Response is required"),
});

type ChatbotFormData = z.infer<typeof chatbotFormSchema>;

export default function ChatbotBuilderPage() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ChatbotRule | null>(null);

  const { data: rules, isLoading } = useQuery<ChatbotRule[]>({
    queryKey: ["/api/chatbot/rules"],
  });

  const form = useForm<ChatbotFormData>({
    resolver: zodResolver(chatbotFormSchema),
    defaultValues: {
      keyword: "",
      response: "",
      isActive: true,
      sessionId: null,
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: ChatbotFormData) => {
      if (editingRule) {
        return await apiRequest("PUT", `/api/chatbot/rules/${editingRule.id}`, data);
      }
      return await apiRequest("POST", "/api/chatbot/rules", data);
    },
    onSuccess: () => {
      toast({
        title: editingRule ? "Rule updated" : "Rule created",
        description: editingRule
          ? "Chatbot rule has been updated successfully"
          : "New chatbot rule has been created",
      });
      setShowDialog(false);
      setEditingRule(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/chatbot/rules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save chatbot rule",
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return await apiRequest("DELETE", `/api/chatbot/rules/${ruleId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Rule deleted",
        description: "Chatbot rule has been deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chatbot/rules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete rule",
        variant: "destructive",
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/chatbot/rules/${ruleId}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbot/rules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle rule",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (rule: ChatbotRule) => {
    setEditingRule(rule);
    form.reset({
      keyword: rule.keyword,
      response: rule.response,
      isActive: rule.isActive,
      sessionId: rule.sessionId,
    });
    setShowDialog(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    form.reset({
      keyword: "",
      response: "",
      isActive: true,
      sessionId: null,
    });
    setShowDialog(true);
  };

  const handleSubmit = (data: ChatbotFormData) => {
    createRuleMutation.mutate(data);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Chatbot Builder</h1>
          <p className="text-muted-foreground mt-2">
            Create automated responses for your WhatsApp chatbot
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2" data-testid="button-create-rule">
          <Plus className="w-4 h-4" />
          Add Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rules && rules.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="hover-elevate" data-testid={`card-rule-${rule.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-base">Keyword: {rule.keyword}</CardTitle>
                      {rule.isActive ? (
                        <Badge className="bg-secondary text-secondary-foreground">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      Response: {rule.response}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) =>
                        toggleRuleMutation.mutate({ ruleId: rule.id, isActive: checked })
                      }
                      data-testid={`switch-rule-${rule.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(rule)}
                      data-testid={`button-edit-${rule.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                      disabled={deleteRuleMutation.isPending}
                      data-testid={`button-delete-${rule.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No Chatbot Rules</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first chatbot rule to start automating responses
            </p>
            <Button onClick={handleCreate} className="gap-2" data-testid="button-create-first-rule">
              <Plus className="w-4 h-4" />
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update your chatbot automation rule"
                : "Add a new automated response for your chatbot"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="keyword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keyword</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., hello, pricing, support"
                        data-testid="input-keyword"
                      />
                    </FormControl>
                    <FormDescription>
                      The keyword that triggers this automated response
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="response"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter the automated response message"
                        rows={4}
                        data-testid="input-response"
                      />
                    </FormControl>
                    <FormDescription>
                      The message that will be sent when the keyword is detected
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable this rule to start automating responses
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    setEditingRule(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  data-testid="button-save-rule"
                >
                  {createRuleMutation.isPending
                    ? "Saving..."
                    : editingRule
                    ? "Update Rule"
                    : "Create Rule"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
