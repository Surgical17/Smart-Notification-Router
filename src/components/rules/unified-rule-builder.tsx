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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, X, Zap, Clock, Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Condition, ConditionGroup, RuleAction } from "@/lib/validations/webhook";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldInput } from "@/components/rules/field-input";
import { usePayloadFields } from "@/hooks/use-payload-fields";

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
}

interface UnifiedRuleBuilderProps {
  webhookId: string;
  rule?: Rule | null;
  correlationRule?: CorrelationRule | null;
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

export function UnifiedRuleBuilder({
  webhookId,
  rule,
  correlationRule,
  onSave,
  onCancel,
}: UnifiedRuleBuilderProps) {
  // Rule type selection
  const [ruleType, setRuleType] = useState<"immediate" | "correlation">(
    correlationRule ? "correlation" : "immediate"
  );

  // Common fields
  const [name, setName] = useState(rule?.name || correlationRule?.name || "");
  const [priority, setPriority] = useState(rule?.priority || correlationRule?.priority || 0);
  const [debounceSeconds, setDebounceSeconds] = useState(
    rule ? rule.debounceMs / 1000 : correlationRule ? correlationRule.debounceMs / 1000 : 0
  );
  const [enabled, setEnabled] = useState(rule?.enabled ?? correlationRule?.enabled ?? true);

  // Condition fields
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "", operator: "equals", value: "" },
  ]);

  // Correlation-specific fields
  const [correlationField, setCorrelationField] = useState(correlationRule?.correlationField || "");
  const [expectedValues, setExpectedValues] = useState<string[]>(
    correlationRule ? JSON.parse(correlationRule.expectedValues) : ["", ""]
  );
  const [timeWindowMinutes, setTimeWindowMinutes] = useState(
    correlationRule ? correlationRule.timeWindowMs / 60000 : 5
  );

  // Action fields
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [notificationPriority, setNotificationPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");

  // Timeout action fields (correlation only)
  const [enableTimeoutActions, setEnableTimeoutActions] = useState(false);
  const [timeoutChannels, setTimeoutChannels] = useState<string[]>([]);
  const [timeoutMessage, setTimeoutMessage] = useState("");
  const [timeoutTitle, setTimeoutTitle] = useState("");
  const [timeoutPriority, setTimeoutPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");

  const [isSaving, setIsSaving] = useState(false);
  const { payloadFields, fieldsLoaded } = usePayloadFields(webhookId);

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
            (c: Condition | ConditionGroup): c is Condition => "field" in c
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

    // Parse existing correlation rule if editing
    if (correlationRule) {
      try {
        const parsedMatchConditions = JSON.parse(correlationRule.matchConditions) as ConditionGroup;
        setLogic(parsedMatchConditions.logic);
        setConditions(
          parsedMatchConditions.conditions.filter(
            (c: Condition | ConditionGroup): c is Condition => "field" in c
          )
        );

        const parsedSuccessActions = JSON.parse(correlationRule.successActions) as RuleAction;
        setSelectedChannels(parsedSuccessActions.channelIds);
        setMessageTemplate(parsedSuccessActions.messageTemplate);
        setTitleTemplate(parsedSuccessActions.titleTemplate || "");
        setNotificationPriority(parsedSuccessActions.priority);

        if (correlationRule.timeoutActions) {
          const parsedTimeoutActions = JSON.parse(correlationRule.timeoutActions) as RuleAction;
          setEnableTimeoutActions(true);
          setTimeoutChannels(parsedTimeoutActions.channelIds);
          setTimeoutMessage(parsedTimeoutActions.messageTemplate);
          setTimeoutTitle(parsedTimeoutActions.titleTemplate || "");
          setTimeoutPriority(parsedTimeoutActions.priority);
        }
      } catch (error) {
        console.error("Error parsing correlation rule:", error);
      }
    }
  }, [rule, correlationRule]);

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

  const addExpectedValue = () => {
    setExpectedValues([...expectedValues, ""]);
  };

  const removeExpectedValue = (index: number) => {
    if (expectedValues.length > 2) {
      setExpectedValues(expectedValues.filter((_, i) => i !== index));
    }
  };

  const updateExpectedValue = (index: number, value: string) => {
    setExpectedValues(
      expectedValues.map((v, i) => (i === index ? value : v))
    );
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const toggleTimeoutChannel = (channelId: string) => {
    setTimeoutChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleSave = async () => {
    // Common validation
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }

    const validConditions = conditions.filter((c: Condition) => c.field.trim());

    if (selectedChannels.length === 0) {
      toast.error("At least one notification channel is required");
      return;
    }

    if (!messageTemplate.trim()) {
      toast.error("Message template is required");
      return;
    }

    // Type-specific validation
    if (ruleType === "correlation") {
      if (!correlationField.trim()) {
        toast.error("Correlation field is required");
        return;
      }

      const validValues = expectedValues.filter((v) => v.trim());
      if (validValues.length < 2) {
        toast.error("At least 2 expected values are required for correlation");
        return;
      }

      if (enableTimeoutActions && timeoutChannels.length === 0) {
        toast.error("At least one channel is required for timeout action");
        return;
      }

      if (enableTimeoutActions && !timeoutMessage.trim()) {
        toast.error("Timeout message template is required");
        return;
      }
    } else {
      if (validConditions.length === 0) {
        toast.error("At least one condition is required");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (ruleType === "immediate") {
        // Save as immediate rule
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
      } else {
        // Save as correlation rule
        const matchConditionGroup: ConditionGroup = {
          logic,
          conditions: validConditions,
        };

        const successActions: RuleAction = {
          channelIds: selectedChannels,
          messageTemplate,
          titleTemplate: titleTemplate || undefined,
          priority: notificationPriority,
        };

        const timeoutActions: RuleAction | null = enableTimeoutActions
          ? {
              channelIds: timeoutChannels,
              messageTemplate: timeoutMessage,
              titleTemplate: timeoutTitle || undefined,
              priority: timeoutPriority,
            }
          : null;

        const validValues = expectedValues.filter((v) => v.trim());

        const url = correlationRule
          ? `/api/correlation-rules/${correlationRule.id}`
          : `/api/webhooks/${webhookId}/correlation-rules`;
        const method = correlationRule ? "PATCH" : "POST";

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            correlationField,
            expectedValues: validValues,
            timeWindowMs: timeWindowMinutes * 60000,
            matchConditions: matchConditionGroup,
            successActions,
            timeoutActions,
            priority,
            enabled,
            debounceMs: debounceSeconds * 1000,
          }),
        });

        if (response.ok) {
          toast.success(
            correlationRule ? "Correlation rule updated successfully" : "Correlation rule created successfully"
          );
          onSave();
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to save correlation rule");
        }
      }
    } catch {
      toast.error("Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Rule Type Selection (only show when creating new) */}
      {!rule && !correlationRule && (
        <Card>
          <CardHeader>
            <CardTitle>Rule Type</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={ruleType}
              onValueChange={(value: "immediate" | "correlation") => setRuleType(value)}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="immediate"
                className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                  ruleType === "immediate" ? "border-primary" : ""
                }`}
              >
                <RadioGroupItem value="immediate" id="immediate" className="sr-only" />
                <Zap className="mb-3 h-6 w-6" />
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium leading-none">Immediate Rule</p>
                  <p className="text-xs text-muted-foreground">
                    Trigger instantly when conditions match
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="correlation"
                className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                  ruleType === "correlation" ? "border-primary" : ""
                }`}
              >
                <RadioGroupItem value="correlation" id="correlation" className="sr-only" />
                <Clock className="mb-3 h-6 w-6" />
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium leading-none">Correlation Rule</p>
                  <p className="text-xs text-muted-foreground">
                    Wait for multiple sources within time window
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder={ruleType === "immediate" ? "e.g., Server Down Alert" : "e.g., Server Sync Check"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Higher priority rules are evaluated first
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="debounce">Debounce (seconds)</Label>
              <Input
                id="debounce"
                type="number"
                min="0"
                value={debounceSeconds}
                onChange={(e) => setDebounceSeconds(Number(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Minimum time between notifications
              </p>
            </div>
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="enabled">Enabled</Label>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Correlation Settings (only for correlation type) */}
      {ruleType === "correlation" && (
        <Card>
          <CardHeader>
            <CardTitle>Correlation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="correlation-field">Field to Correlate</Label>
                <Input
                  id="correlation-field"
                  placeholder="e.g., server, host, source"
                  value={correlationField}
                  onChange={(e) => setCorrelationField(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  The field in payload to track
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-window">Time Window (minutes)</Label>
                <Input
                  id="time-window"
                  type="number"
                  min="1"
                  value={timeWindowMinutes}
                  onChange={(e) => setTimeWindowMinutes(Number(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  How long to wait for all values
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expected Values (all must report)</Label>
              <div className="space-y-2">
                {expectedValues.map((value, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`e.g., server-${String.fromCharCode(97 + index)}`}
                      value={value}
                      onChange={(e) => updateExpectedValue(index, e.target.value)}
                    />
                    {expectedValues.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeExpectedValue(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addExpectedValue}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Value
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>
            {ruleType === "immediate" ? "Trigger Conditions" : "Match Conditions"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {ruleType === "immediate"
              ? "When these conditions match, the action triggers immediately"
              : "These conditions must match on ALL notifications for correlation to apply"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {conditions.length > 0 && (
            <div className="flex items-center gap-2">
              <Label>Logic:</Label>
              <Select
                value={logic}
                onValueChange={(value: "AND" | "OR") => setLogic(value)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {payloadFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Field suggestions loaded from last received payload. Use dot notation for nested fields.
            </p>
          )}
          {payloadFields.length === 0 && fieldsLoaded && (
            <p className="text-xs text-muted-foreground">
              Send a test webhook to enable field suggestions. Use dot notation for nested fields (e.g. heartbeat.status).
            </p>
          )}

          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <FieldInput
                        placeholder="Field path (e.g. heartbeat.status)"
                        value={condition.field}
                        onChange={(val) =>
                          updateCondition(index, "field", val)
                        }
                        payloadFields={payloadFields}
                      />
                    </div>
                    <div className="col-span-3">
                      <Select
                        value={condition.operator}
                        onValueChange={(value) =>
                          updateCondition(index, "operator", value)
                        }
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
                    </div>
                    <div className="col-span-4">
                      {!noValueOperators.includes(condition.operator) && (
                        <Input
                          placeholder="Value"
                          value={String(condition.value ?? "")}
                          onChange={(e) =>
                            updateCondition(index, "value", e.target.value)
                          }
                        />
                      )}
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondition}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Condition
          </Button>
        </CardContent>
      </Card>

      {/* Action */}
      <Card>
        <CardHeader>
          <CardTitle>
            {ruleType === "immediate" ? "Action" : "Success Action"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {ruleType === "immediate"
              ? "What to do when conditions match"
              : "When all expected values are received within the time window"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notification Channels</Label>
            {channels.filter((c: Channel) => c.enabled).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels configured. Add a channel first.
              </p>
            ) : (
              <div className="space-y-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between font-normal"
                      type="button"
                    >
                      {selectedChannels.length === 0
                        ? "Select channels..."
                        : `${selectedChannels.length} channel${selectedChannels.length > 1 ? "s" : ""} selected`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <div className="max-h-60 overflow-y-auto">
                      {channels
                        .filter((c: Channel) => c.enabled)
                        .map((channel: Channel) => (
                          <button
                            key={channel.id}
                            type="button"
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                            onClick={() => toggleChannel(channel.id)}
                          >
                            <div className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                              selectedChannels.includes(channel.id)
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground"
                            }`}>
                              {selectedChannels.includes(channel.id) && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                            <span>{channel.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{channel.type}</span>
                          </button>
                        ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedChannels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedChannels.map((channelId) => {
                      const channel = channels.find((c: Channel) => c.id === channelId);
                      return channel ? (
                        <Badge key={channelId} variant="secondary" className="gap-1">
                          {channel.name}
                          <button
                            type="button"
                            onClick={() => toggleChannel(channelId)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title Template (optional)</Label>
            <Input
              id="title"
              placeholder="e.g., {{server}} Alert"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message Template</Label>
            <Textarea
              id="message"
              placeholder={
                ruleType === "immediate"
                  ? "e.g., Server {{server}} is {{status}}"
                  : "e.g., All servers reported: {{_correlation.sources}}"
              }
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              {ruleType === "immediate"
                ? "Use {{field}} syntax to include payload values"
                : "Available: {{_correlation.sources}}, {{_correlation.timeElapsed}}, and payload fields"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority-select">Priority</Label>
            <Select
              value={notificationPriority}
              onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                setNotificationPriority(value)
              }
            >
              <SelectTrigger id="priority-select">
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
        </CardContent>
      </Card>

      {/* Timeout Action (only for correlation type) */}
      {ruleType === "correlation" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Timeout Action (Optional)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  When time window expires without receiving all values
                </p>
              </div>
              <Switch
                checked={enableTimeoutActions}
                onCheckedChange={setEnableTimeoutActions}
              />
            </div>
          </CardHeader>
          {enableTimeoutActions && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notification Channels</Label>
                <div className="space-y-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                        type="button"
                      >
                        {timeoutChannels.length === 0
                          ? "Select channels..."
                          : `${timeoutChannels.length} channel${timeoutChannels.length > 1 ? "s" : ""} selected`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="max-h-60 overflow-y-auto">
                        {channels
                          .filter((c: Channel) => c.enabled)
                          .map((channel: Channel) => (
                            <button
                              key={channel.id}
                              type="button"
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                              onClick={() => toggleTimeoutChannel(channel.id)}
                            >
                              <div className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                                timeoutChannels.includes(channel.id)
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground"
                              }`}>
                                {timeoutChannels.includes(channel.id) && (
                                  <Check className="h-3 w-3" />
                                )}
                              </div>
                              <span>{channel.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{channel.type}</span>
                            </button>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {timeoutChannels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {timeoutChannels.map((channelId) => {
                        const channel = channels.find((c: Channel) => c.id === channelId);
                        return channel ? (
                          <Badge key={channelId} variant="secondary" className="gap-1">
                            {channel.name}
                            <button
                              type="button"
                              onClick={() => toggleTimeoutChannel(channelId)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout-title">Title Template (optional)</Label>
                <Input
                  id="timeout-title"
                  placeholder="e.g., Correlation Timeout"
                  value={timeoutTitle}
                  onChange={(e) => setTimeoutTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout-message">Message Template</Label>
                <Textarea
                  id="timeout-message"
                  placeholder="e.g., Missing: {{_correlation.missing}}"
                  value={timeoutMessage}
                  onChange={(e) => setTimeoutMessage(e.target.value)}
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Available: {"{{"}_correlation.received{"}}"}, {"{{"}_correlation.missing{"}}"}, {"{{"}_correlation.timeElapsed{"}}"}, and payload fields
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout-priority">Priority</Label>
                <Select
                  value={timeoutPriority}
                  onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                    setTimeoutPriority(value)
                  }
                >
                  <SelectTrigger id="timeout-priority">
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
            </CardContent>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : rule || correlationRule ? "Update Rule" : "Create Rule"}
        </Button>
      </div>
    </div>
  );
}
