"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Webhook as WebhookIcon, Copy, ExternalLink, Trash2 } from "lucide-react";

interface Webhook {
  id: string;
  name: string;
  uniqueUrl: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  _count: {
    rules: number;
    logs: number;
  };
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: "", description: "" });
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch("/api/webhooks");
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data);
      }
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      toast.error("Failed to fetch webhooks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleCreate = async () => {
    if (!newWebhook.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });

      if (response.ok) {
        const webhook = await response.json();
        setWebhooks([webhook, ...webhooks]);
        setIsCreateOpen(false);
        setNewWebhook({ name: "", description: "" });
        toast.success("Webhook created successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create webhook");
      }
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setWebhooks(
          webhooks.map((w) => (w.id === id ? { ...w, enabled } : w))
        );
        toast.success(`Webhook ${enabled ? "enabled" : "disabled"}`);
      }
    } catch {
      toast.error("Failed to update webhook");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setWebhooks(webhooks.filter((w) => w.id !== id));
        toast.success("Webhook deleted successfully");
      }
    } catch {
      toast.error("Failed to delete webhook");
    } finally {
      setDeleteWebhookId(null);
    }
  };

  const copyToClipboard = (uniqueUrl: string) => {
    const fullUrl = `${window.location.origin}/api/webhook/${uniqueUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Webhook URL copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Webhooks</h2>
          <p className="text-muted-foreground">
            Manage your webhook endpoints and routing rules
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Create a new webhook endpoint to receive notifications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="My Webhook"
                  value={newWebhook.name}
                  onChange={(e) =>
                    setNewWebhook({ ...newWebhook, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What is this webhook for?"
                  value={newWebhook.description}
                  onChange={(e) =>
                    setNewWebhook({ ...newWebhook, description: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WebhookIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No webhooks yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first webhook to start receiving notifications
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{webhook.name}</CardTitle>
                    {webhook.description && (
                      <CardDescription className="line-clamp-2">
                        {webhook.description}
                      </CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={webhook.enabled}
                    onCheckedChange={(checked) =>
                      handleToggle(webhook.id, checked)
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={webhook.enabled ? "default" : "secondary"}>
                    {webhook.enabled ? "Active" : "Disabled"}
                  </Badge>
                  <Badge variant="outline">{webhook._count.rules} rules</Badge>
                  <Badge variant="outline">{webhook._count.logs} logs</Badge>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs truncate">
                    /api/webhook/{webhook.uniqueUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(webhook.uniqueUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/webhooks/${webhook.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Configure
                    </Link>
                  </Button>
                  <Dialog
                    open={deleteWebhookId === webhook.id}
                    onOpenChange={(open) =>
                      setDeleteWebhookId(open ? webhook.id : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Webhook</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete &quot;{webhook.name}&quot;? This
                          action cannot be undone and will delete all associated
                          rules and logs.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setDeleteWebhookId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDelete(webhook.id)}
                        >
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
