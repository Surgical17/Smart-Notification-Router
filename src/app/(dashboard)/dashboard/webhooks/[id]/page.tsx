"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Save,
  Plus,
  Trash2,
  Settings,
  ScrollText,
  ListFilter,
} from "lucide-react";
import Link from "next/link";
import { RuleBuilder } from "@/components/rules/rule-builder";

interface Rule {
  id: string;
  name: string;
  conditions: string;
  actions: string;
  priority: number;
  enabled: boolean;
  debounceMs: number;
  lastTriggered: string | null;
  createdAt: string;
}

interface Webhook {
  id: string;
  name: string;
  uniqueUrl: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  rules: Rule[];
  _count: {
    logs: number;
  };
}

interface WebhookLog {
  id: string;
  timestamp: string;
  payload: string;
  ruleTriggered: string | null;
  notificationSent: boolean;
  status: string;
  errorMessage: string | null;
  responseTime: number | null;
}

export default function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const fetchWebhook = async () => {
    try {
      const response = await fetch(`/api/webhooks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setWebhook(data);
        setEditForm({
          name: data.name,
          description: data.description || "",
        });
      } else if (response.status === 404) {
        router.push("/dashboard/webhooks");
      }
    } catch (error) {
      console.error("Error fetching webhook:", error);
      toast.error("Failed to fetch webhook");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/webhooks/${id}/logs?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  useEffect(() => {
    fetchWebhook();
    fetchLogs();
  }, [id]);

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setWebhook(updated);
        toast.success("Webhook updated successfully");
      } else {
        toast.error("Failed to update webhook");
      }
    } catch {
      toast.error("Failed to update webhook");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWebhook = async (enabled: boolean) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setWebhook((prev) => (prev ? { ...prev, enabled } : null));
        toast.success(`Webhook ${enabled ? "enabled" : "disabled"}`);
      }
    } catch {
      toast.error("Failed to update webhook");
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setWebhook((prev) =>
          prev
            ? {
                ...prev,
                rules: prev.rules.map((r) =>
                  r.id === ruleId ? { ...r, enabled } : r
                ),
              }
            : null
        );
        toast.success(`Rule ${enabled ? "enabled" : "disabled"}`);
      }
    } catch {
      toast.error("Failed to update rule");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setWebhook((prev) =>
          prev
            ? { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) }
            : null
        );
        toast.success("Rule deleted successfully");
      }
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  const handleRuleSaved = () => {
    setIsRuleBuilderOpen(false);
    setEditingRule(null);
    fetchWebhook();
  };

  const copyToClipboard = () => {
    if (!webhook) return;
    const fullUrl = `${window.location.origin}/api/webhook/${webhook.uniqueUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Webhook URL copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!webhook) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/webhooks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{webhook.name}</h2>
          <p className="text-muted-foreground">
            Configure webhook settings and routing rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {webhook.enabled ? "Enabled" : "Disabled"}
          </span>
          <Switch
            checked={webhook.enabled}
            onCheckedChange={handleToggleWebhook}
          />
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ListFilter className="mr-2 h-4 w-4" />
            Rules ({webhook.rules.length})
          </TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText className="mr-2 h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook URL</CardTitle>
              <CardDescription>
                Send POST requests to this URL to trigger rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
                  {window.location.origin}/api/webhook/{webhook.uniqueUrl}
                </code>
                <Button variant="outline" onClick={copyToClipboard}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Update webhook name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Routing Rules</h3>
              <p className="text-sm text-muted-foreground">
                Rules are evaluated in priority order (highest first)
              </p>
            </div>
            <Button onClick={() => setIsRuleBuilderOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>

          {webhook.rules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListFilter className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No rules yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create rules to define when and how notifications are sent
                </p>
                <Button onClick={() => setIsRuleBuilderOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {webhook.rules.map((rule) => (
                <Card key={rule.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{rule.name}</h4>
                          <Badge variant="outline">Priority: {rule.priority}</Badge>
                          {rule.debounceMs > 0 && (
                            <Badge variant="secondary">
                              Debounce: {rule.debounceMs / 1000}s
                            </Badge>
                          )}
                        </div>
                        {rule.lastTriggered && (
                          <p className="text-sm text-muted-foreground">
                            Last triggered:{" "}
                            {new Date(rule.lastTriggered).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            handleToggleRule(rule.id, checked)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingRule(rule);
                            setIsRuleBuilderOpen(true);
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete Rule</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete &quot;{rule.name}&quot;?
                                This action cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline">Cancel</Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                Delete
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Logs</CardTitle>
              <CardDescription>
                Last 20 webhook requests received
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No logs yet. Send a webhook to see activity here.
                </p>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between border-b pb-4 last:border-0"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              log.status === "success"
                                ? "default"
                                : log.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {log.status}
                          </Badge>
                          {log.notificationSent && (
                            <Badge variant="outline">Notification sent</Badge>
                          )}
                          {log.responseTime && (
                            <span className="text-xs text-muted-foreground">
                              {log.responseTime}ms
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                        {log.errorMessage && (
                          <p className="text-sm text-destructive">
                            {log.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isRuleBuilderOpen} onOpenChange={setIsRuleBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Rule" : "Create Rule"}
            </DialogTitle>
            <DialogDescription>
              Define conditions and actions for this routing rule
            </DialogDescription>
          </DialogHeader>
          <RuleBuilder
            webhookId={webhook.id}
            rule={editingRule}
            onSave={handleRuleSaved}
            onCancel={() => {
              setIsRuleBuilderOpen(false);
              setEditingRule(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
