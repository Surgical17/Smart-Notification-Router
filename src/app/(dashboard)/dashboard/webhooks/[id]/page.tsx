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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CopyPlus,
  Save,
  Plus,
  Trash2,
  Settings,
  ScrollText,
  ListFilter,
  Target,
  Zap,
  Network,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { UnifiedRuleBuilder } from "@/components/rules/unified-rule-builder";

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

interface CorrelationRule {
  id: string;
  name: string;
  correlationField: string;
  expectedValues: string;
  timeWindowMs: number;
  matchConditions: string;
  successActions: string;
  timeoutActions: string | null;
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
  matchMode?: string;
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
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    matchMode: "first_match" as "first_match" | "all_matches"
  });
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [correlationRules, setCorrelationRules] = useState<CorrelationRule[]>([]);
  const [editingCorrelationRule, setEditingCorrelationRule] = useState<CorrelationRule | null>(null);
  const [activeTab, setActiveTab] = useState("settings");
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  const fetchWebhook = async () => {
    try {
      const response = await fetch(`/api/webhooks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setWebhook(data);
        setEditForm({
          name: data.name,
          description: data.description || "",
          matchMode: data.matchMode || "first_match",
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

  const fetchCorrelationRules = async () => {
    try {
      const response = await fetch(`/api/webhooks/${id}/correlation-rules`);
      if (response.ok) {
        const data = await response.json();
        setCorrelationRules(data);
      }
    } catch (error) {
      console.error("Error fetching correlation rules:", error);
    }
  };

  useEffect(() => {
    fetchWebhook();
    fetchLogs();
    fetchCorrelationRules();
  }, [id]);

  // Auto-refresh logs every 10 seconds when on the logs tab
  useEffect(() => {
    if (activeTab !== "logs") return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab, id]);

  const handleRefreshLogs = async () => {
    setIsRefreshingLogs(true);
    await fetchLogs();
    setIsRefreshingLogs(false);
  };

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
                rules: prev.rules.map((r: Rule) =>
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
            ? { ...prev, rules: prev.rules.filter((r: Rule) => r.id !== ruleId) }
            : null
        );
        toast.success("Rule deleted successfully");
      }
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  const handleDeleteCorrelationRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/correlation-rules/${ruleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCorrelationRules((prev) => prev.filter((r: CorrelationRule) => r.id !== ruleId));
        toast.success("Correlation rule deleted successfully");
      }
    } catch {
      toast.error("Failed to delete correlation rule");
    }
  };

  const handleDuplicateRule = async (rule: Rule) => {
    try {
      const conditions = JSON.parse(rule.conditions);
      const actions = JSON.parse(rule.actions);
      const response = await fetch(`/api/webhooks/${id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${rule.name} (copy)`,
          conditions,
          actions,
          priority: rule.priority,
          enabled: false,
          debounceMs: rule.debounceMs,
        }),
      });
      if (response.ok) {
        toast.success("Rule duplicated successfully");
        fetchWebhook();
      } else {
        toast.error("Failed to duplicate rule");
      }
    } catch {
      toast.error("Failed to duplicate rule");
    }
  };

  const handleDuplicateCorrelationRule = async (rule: CorrelationRule) => {
    try {
      const matchConditions = JSON.parse(rule.matchConditions);
      const successActions = JSON.parse(rule.successActions);
      const timeoutActions = rule.timeoutActions ? JSON.parse(rule.timeoutActions) : null;
      const expectedValues = JSON.parse(rule.expectedValues);
      const response = await fetch(`/api/webhooks/${id}/correlation-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${rule.name} (copy)`,
          correlationField: rule.correlationField,
          expectedValues,
          timeWindowMs: rule.timeWindowMs,
          matchConditions,
          successActions,
          timeoutActions,
          priority: rule.priority,
          enabled: false,
          debounceMs: rule.debounceMs,
        }),
      });
      if (response.ok) {
        toast.success("Correlation rule duplicated successfully");
        fetchCorrelationRules();
      } else {
        toast.error("Failed to duplicate correlation rule");
      }
    } catch {
      toast.error("Failed to duplicate correlation rule");
    }
  };

  const handleRuleSaved = () => {
    setIsRuleBuilderOpen(false);
    setEditingRule(null);
    setEditingCorrelationRule(null);
    fetchWebhook();
    fetchCorrelationRules();
  };

  const copyToClipboard = async () => {
    if (!webhook) return;
    const fullUrl = `${window.location.origin}/api/webhook/${webhook.uniqueUrl}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        // Fallback for non-HTTPS contexts
        const textarea = document.createElement("textarea");
        textarea.value = fullUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Webhook URL copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
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

      <Tabs defaultValue="settings" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ListFilter className="mr-2 h-4 w-4" />
            Rules ({webhook.rules.length + correlationRules.length})
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
              <div className="space-y-2">
                <Label htmlFor="matchMode">Rule Matching Mode</Label>
                <Select
                  value={editForm.matchMode}
                  onValueChange={(value: "first_match" | "all_matches") =>
                    setEditForm({ ...editForm, matchMode: value })
                  }
                >
                  <SelectTrigger id="matchMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_match">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <div>
                          <div className="font-medium">First Match</div>
                          <div className="text-xs text-muted-foreground">
                            Stop after first matching rule
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="all_matches">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        <div>
                          <div className="font-medium">All Matches</div>
                          <div className="text-xs text-muted-foreground">
                            Trigger all matching rules
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {editForm.matchMode === "first_match"
                    ? "Rules are evaluated by priority. Only the first matching rule will trigger."
                    : "All matching rules will trigger their actions. Useful for multi-team notifications."}
                </p>
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
              <h3 className="text-lg font-medium">Rules</h3>
              <p className="text-sm text-muted-foreground">
                Rules are evaluated in priority order (highest first)
              </p>
            </div>
            <Button onClick={() => setIsRuleBuilderOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>

          {webhook.rules.length === 0 && correlationRules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListFilter className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No rules yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create immediate rules for instant triggers or correlation rules for time-based multi-source tracking
                </p>
                <Button onClick={() => setIsRuleBuilderOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Immediate Rules */}
              {webhook.rules.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    Immediate Rules
                  </div>
                  {webhook.rules.map((rule) => (
                    <Card key={rule.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-blue-500">
                                <Zap className="h-3 w-3 mr-1" />
                                Immediate
                              </Badge>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicateRule(rule)}
                          title="Duplicate rule"
                        >
                          <CopyPlus className="h-4 w-4" />
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

              {/* Correlation Rules */}
              {correlationRules.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Network className="h-4 w-4" />
                    Correlation Rules
                  </div>
                  {correlationRules.map((rule) => (
                    <Card key={rule.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-purple-500">
                                <Network className="h-3 w-3 mr-1" />
                                Correlation
                              </Badge>
                              <h4 className="font-medium">{rule.name}</h4>
                              <Badge variant="outline">Priority: {rule.priority}</Badge>
                              {!rule.enabled && (
                                <Badge variant="secondary">Disabled</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                <strong>Field:</strong> {rule.correlationField} |
                                <strong> Values:</strong> {JSON.parse(rule.expectedValues).join(", ")}
                              </p>
                              <p>
                                <strong>Time Window:</strong> {rule.timeWindowMs / 60000} minutes
                              </p>
                              {rule.lastTriggered && (
                                <p>
                                  Last triggered: {new Date(rule.lastTriggered).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingCorrelationRule(rule);
                                setIsRuleBuilderOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDuplicateCorrelationRule(rule)}
                              title="Duplicate rule"
                            >
                              <CopyPlus className="h-4 w-4" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Correlation Rule</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to delete this correlation rule? This action cannot be undone.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleDeleteCorrelationRule(rule.id)}
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Webhook Logs</CardTitle>
                  <CardDescription>
                    Last 20 webhook requests received — auto-refreshes every 10s
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshLogs}
                  disabled={isRefreshingLogs}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshingLogs ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No logs yet. Send a webhook to see activity here.
                </p>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => {
                    let payload: any = {};
                    try {
                      payload = JSON.parse(log.payload);
                    } catch {
                      // Ignore parse errors
                    }

                    return (
                      <div
                        key={log.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
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
                                <Badge variant="outline" className="bg-green-50">
                                  Notification sent
                                </Badge>
                              )}
                              {log.ruleTriggered && (
                                <Badge variant="outline">
                                  Rule: {log.ruleTriggered}
                                </Badge>
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
                            {log.status === "no_match" && (
                              <p className="text-sm text-muted-foreground">
                                No immediate rules matched. Check correlation rules if enabled.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Payload Preview */}
                        {Object.keys(payload).length > 0 && payload._metadata && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View payload
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                              {JSON.stringify(payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isRuleBuilderOpen} onOpenChange={setIsRuleBuilderOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule || editingCorrelationRule ? "Edit Rule" : "Create Rule"}
            </DialogTitle>
            <DialogDescription>
              Build dynamic rules with immediate triggers or field-based correlations
            </DialogDescription>
          </DialogHeader>
          <UnifiedRuleBuilder
            webhookId={webhook.id}
            rule={editingRule}
            correlationRule={editingCorrelationRule}
            onSave={handleRuleSaved}
            onCancel={() => {
              setIsRuleBuilderOpen(false);
              setEditingRule(null);
              setEditingCorrelationRule(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
