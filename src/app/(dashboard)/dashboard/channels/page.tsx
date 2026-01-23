"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Bell,
  Trash2,
  Send,
  MessageCircle,
  Mail,
  Hash,
  Webhook,
  Link as LinkIcon,
  Network,
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  createdAt: string;
}

const channelTypeInfo: Record<
  string,
  { label: string; icon: React.ReactNode; fields: ChannelField[] }
> = {
  gotify: {
    label: "Gotify",
    icon: <Bell className="h-4 w-4" />,
    fields: [
      { name: "url", label: "Server URL", type: "url", placeholder: "https://gotify.example.com" },
      { name: "token", label: "App Token", type: "password", placeholder: "Your app token" },
    ],
  },
  telegram: {
    label: "Telegram",
    icon: <MessageCircle className="h-4 w-4" />,
    fields: [
      { name: "botToken", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF..." },
      { name: "chatId", label: "Chat ID", type: "text", placeholder: "-1001234567890" },
    ],
  },
  discord: {
    label: "Discord",
    icon: <Hash className="h-4 w-4" />,
    fields: [
      { name: "webhookUrl", label: "Webhook URL", type: "url", placeholder: "https://discord.com/api/webhooks/..." },
    ],
  },
  slack: {
    label: "Slack",
    icon: <Hash className="h-4 w-4" />,
    fields: [
      { name: "webhookUrl", label: "Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/..." },
    ],
  },
  email: {
    label: "Email (SMTP)",
    icon: <Mail className="h-4 w-4" />,
    fields: [
      { name: "host", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com" },
      { name: "port", label: "Port", type: "number", placeholder: "587" },
      { name: "user", label: "Username", type: "text", placeholder: "your@email.com" },
      { name: "pass", label: "Password", type: "password", placeholder: "App password" },
      { name: "to", label: "Recipient", type: "email", placeholder: "recipient@example.com" },
    ],
  },
  apprise_url: {
    label: "Apprise URL",
    icon: <LinkIcon className="h-4 w-4" />,
    fields: [
      { name: "appriseUrl", label: "Apprise URL", type: "text", placeholder: "gotify://host/token" },
    ],
  },
  webhook: {
    label: "Custom Webhook",
    icon: <Webhook className="h-4 w-4" />,
    fields: [
      { name: "url", label: "Webhook URL", type: "url", placeholder: "https://your-service.com/webhook" },
    ],
  },
  smart_router: {
    label: "Smart Router",
    icon: <Network className="h-4 w-4" />,
    fields: [
      { name: "url", label: "Router Webhook URL", type: "url", placeholder: "https://router.example.com/api/webhook/abc123" },
    ],
  },
};

interface ChannelField {
  name: string;
  label: string;
  type: string;
  placeholder: string;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);

  const [newChannel, setNewChannel] = useState<{
    name: string;
    type: string;
    config: Record<string, string>;
  }>({
    name: "",
    type: "",
    config: {},
  });

  const fetchChannels = async () => {
    try {
      const response = await fetch("/api/channels");
      if (response.ok) {
        const data = await response.json();
        setChannels(data);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast.error("Failed to fetch channels");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreate = async () => {
    if (!newChannel.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!newChannel.type) {
      toast.error("Please select a channel type");
      return;
    }

    // Convert port to number for email
    const config = { ...newChannel.config };
    if (newChannel.type === "email" && config.port) {
      (config as Record<string, unknown>).port = parseInt(config.port, 10);
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChannel.name,
          type: newChannel.type,
          config,
        }),
      });

      if (response.ok) {
        const channel = await response.json();
        setChannels([channel, ...channels]);
        setIsCreateOpen(false);
        setNewChannel({ name: "", type: "", config: {} });
        toast.success("Channel created successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create channel");
      }
    } catch {
      toast.error("Failed to create channel");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setChannels(
          channels.map((c) => (c.id === id ? { ...c, enabled } : c))
        );
        toast.success(`Channel ${enabled ? "enabled" : "disabled"}`);
      }
    } catch {
      toast.error("Failed to update channel");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/channels/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setChannels(channels.filter((c) => c.id !== id));
        toast.success("Channel deleted successfully");
      }
    } catch {
      toast.error("Failed to delete channel");
    } finally {
      setDeleteChannelId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingChannelId(id);
    try {
      const response = await fetch(`/api/channels/${id}/test`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Test notification sent successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send test notification");
      }
    } catch {
      toast.error("Failed to send test notification");
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleTypeChange = (type: string) => {
    setNewChannel({ ...newChannel, type, config: {} });
  };

  const handleConfigChange = (field: string, value: string) => {
    setNewChannel({
      ...newChannel,
      config: { ...newChannel.config, [field]: value },
    });
  };

  const currentTypeInfo = newChannel.type
    ? channelTypeInfo[newChannel.type]
    : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Notification Channels
          </h2>
          <p className="text-muted-foreground">
            Configure where your notifications are sent
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Notification Channel</DialogTitle>
              <DialogDescription>
                Configure a new notification destination
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Name</Label>
                <Input
                  id="channel-name"
                  placeholder="My Gotify Server"
                  value={newChannel.name}
                  onChange={(e) =>
                    setNewChannel({ ...newChannel, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Channel Type</Label>
                <Select
                  value={newChannel.type}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(channelTypeInfo).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {info.icon}
                          {info.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentTypeInfo && (
                <div className="space-y-4 pt-2">
                  {currentTypeInfo.fields.map((field) => (
                    <div key={field.name} className="space-y-2">
                      <Label htmlFor={field.name}>{field.label}</Label>
                      <Input
                        id={field.name}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={newChannel.config[field.name] || ""}
                        onChange={(e) =>
                          handleConfigChange(field.name, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
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

      {channels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No channels yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add notification channels to start receiving alerts
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Channel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => {
            const typeInfo = channelTypeInfo[channel.type];
            return (
              <Card key={channel.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {typeInfo?.icon || <Bell className="h-4 w-4" />}
                      <CardTitle className="text-lg">{channel.name}</CardTitle>
                    </div>
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(channel.id, checked)
                      }
                    />
                  </div>
                  <CardDescription>
                    {typeInfo?.label || channel.type}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={channel.enabled ? "default" : "secondary"}>
                      {channel.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleTest(channel.id)}
                      disabled={testingChannelId === channel.id || !channel.enabled}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {testingChannelId === channel.id ? "Sending..." : "Test"}
                    </Button>
                    <Dialog
                      open={deleteChannelId === channel.id}
                      onOpenChange={(open) =>
                        setDeleteChannelId(open ? channel.id : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Channel</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete &quot;{channel.name}&quot;?
                            Any rules using this channel will no longer send
                            notifications to it.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setDeleteChannelId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(channel.id)}
                          >
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
