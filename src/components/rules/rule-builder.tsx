"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { ConditionGroup, Condition, RuleAction } from "@/lib/validations/webhook";

interface Channel {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

interface Rule {
  id: string;
  name: string;
  conditions: string;
  actions: string;
  priority: number;
  enabled: boolean;
  debounceMs: number;
}

interface RuleBuilderProps {
  webhookId: string;
  rule?: Rule | null;
  onSave: () => void;
  onCancel: () => void;
}

const operators = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "greater_than_or_equal", label: "Greater than or equal" },
  { value: "less_than_or_equal", label: "Less than or equal" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
  { value: "is_true", label: "Is true" },
  { value: "is_false", label: "Is false" },
  { value: "regex_match", label: "Matches regex" },
  { value: "server_is_online", label: "Server is online" },
  { value: "server_is_offline", label: "Server is offline" },
];

const noValueOperators = [
  "is_empty",
  "is_not_empty",
  "is_true",
  "is_false",
  "server_is_online",
  "server_is_offline",
];

export function RuleBuilder({
  webhookId,
  rule,
  onSave,
  onCancel,
}: RuleBuilderProps) {
  const [name, setName] = useState(rule?.name || "");
  const [priority, setPriority] = useState(rule?.priority || 0);
  const [debounceSeconds, setDebounceSeconds] = useState(
    rule ? rule.debounceMs / 1000 : 0
  );
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "", operator: "equals", value: "" },
  ]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [notificationPriority, setNotificationPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Fetch channels
    const fetchChannels = async () => {
      try {
        const response = await fetch("/api/channels");
        if (response.ok) {
          const data = await response.json();
          setChannels(data);
        }
      } catch (error) {
        console.error("Error fetching channels:", error);
      }
    };

    fetchChannels();

    // Parse existing rule if editing
    if (rule) {
      try {
        const parsedConditions = JSON.parse(rule.conditions) as ConditionGroup;
        setLogic(parsedConditions.logic);
        setConditions(
          parsedConditions.conditions.filter(
            (c): c is Condition => "field" in c
          )
        );

        const parsedActions = JSON.parse(rule.actions) as RuleAction;
        setSelectedChannels(parsedActions.channelIds);
        setMessageTemplate(parsedActions.messageTemplate);
        setTitleTemplate(parsedActions.titleTemplate || "");
        setNotificationPriority(parsedActions.priority);
      } catch (error) {
        console.error("Error parsing rule:", error);
      }
    }
  }, [rule]);

  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (
    index: number,
    field: keyof Condition,
    value: string
  ) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }

    const validConditions = conditions.filter((c) => c.field.trim());
    if (validConditions.length === 0) {
      toast.error("At least one condition is required");
      return;
    }

    if (selectedChannels.length === 0) {
      toast.error("At least one notification channel is required");
      return;
    }

    if (!messageTemplate.trim()) {
      toast.error("Message template is required");
      return;
    }

    const conditionGroup: ConditionGroup = {
      logic,
      conditions: validConditions,
    };

    const actions: RuleAction = {
      channelIds: selectedChannels,
      messageTemplate,
      titleTemplate: titleTemplate || undefined,
      priority: notificationPriority,
    };

    setIsSaving(true);
    try {
      const url = rule
        ? `/api/rules/${rule.id}`
        : `/api/webhooks/${webhookId}/rules`;
      const method = rule ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          conditions: conditionGroup,
          actions,
          priority,
          enabled,
          debounceMs: debounceSeconds * 1000,
        }),
      });

      if (response.ok) {
        toast.success(rule ? "Rule updated successfully" : "Rule created successfully");
        onSave();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save rule");
      }
    } catch {
      toast.error("Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              placeholder="e.g., Server Down Alert"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min={0}
              max={100}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="debounce">Debounce (seconds)</Label>
            <Input
              id="debounce"
              type="number"
              min={0}
              value={debounceSeconds}
              onChange={(e) => setDebounceSeconds(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Prevent duplicate notifications within this time
            </p>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>Rule enabled</Label>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Conditions</Label>
          <Select value={logic} onValueChange={(v) => setLogic(v as "AND" | "OR")}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {conditions.map((condition, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2" />
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Field (e.g., status, server)"
                    value={condition.field}
                    onChange={(e) =>
                      updateCondition(index, "field", e.target.value)
                    }
                  />
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(index, "operator", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!noValueOperators.includes(condition.operator) && (
                    <Input
                      placeholder="Value"
                      value={String(condition.value || "")}
                      onChange={(e) =>
                        updateCondition(index, "value", e.target.value)
                      }
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(index)}
                  disabled={conditions.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" onClick={addCondition}>
          <Plus className="mr-2 h-4 w-4" />
          Add Condition
        </Button>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Actions</Label>

        <div className="space-y-2">
          <Label>Notification Channels</Label>
          <div className="flex flex-wrap gap-2">
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels configured.{" "}
                <a href="/dashboard/channels" className="text-primary hover:underline">
                  Add a channel
                </a>
              </p>
            ) : (
              channels.map((channel) => (
                <Badge
                  key={channel.id}
                  variant={
                    selectedChannels.includes(channel.id)
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleChannel(channel.id)}
                >
                  {channel.name} ({channel.type})
                </Badge>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title-template">Title Template (optional)</Label>
          <Input
            id="title-template"
            placeholder="e.g., {{server}} Alert"
            value={titleTemplate}
            onChange={(e) => setTitleTemplate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message-template">Message Template</Label>
          <Textarea
            id="message-template"
            placeholder="e.g., Server {{server}} is now {{status}}. Received at {{_metadata.receivedAt}}"
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Use {"{{field}}"} syntax to include payload values. Nested fields supported:
            {"{{payload.nested.field}}"}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Notification Priority</Label>
          <Select
            value={notificationPriority}
            onValueChange={(v) =>
              setNotificationPriority(v as "low" | "normal" | "high" | "urgent")
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
        </Button>
      </div>
    </div>
  );
}
