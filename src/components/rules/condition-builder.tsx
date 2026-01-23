"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Layers } from "lucide-react";
import type { Condition, ConditionGroup, ConditionOperator } from "@/lib/validations/webhook";

const OPERATORS: { value: ConditionOperator; label: string; needsValue: boolean }[] = [
  { value: "equals", label: "Equals", needsValue: true },
  { value: "not_equals", label: "Not Equals", needsValue: true },
  { value: "contains", label: "Contains", needsValue: true },
  { value: "not_contains", label: "Does Not Contain", needsValue: true },
  { value: "starts_with", label: "Starts With", needsValue: true },
  { value: "ends_with", label: "Ends With", needsValue: true },
  { value: "greater_than", label: "Greater Than", needsValue: true },
  { value: "less_than", label: "Less Than", needsValue: true },
  { value: "greater_than_or_equal", label: "Greater Than or Equal", needsValue: true },
  { value: "less_than_or_equal", label: "Less Than or Equal", needsValue: true },
  { value: "is_empty", label: "Is Empty", needsValue: false },
  { value: "is_not_empty", label: "Is Not Empty", needsValue: false },
  { value: "is_true", label: "Is True", needsValue: false },
  { value: "is_false", label: "Is False", needsValue: false },
  { value: "regex_match", label: "Regex Match", needsValue: true },
  { value: "server_is_online", label: "Server Is Online", needsValue: false },
  { value: "server_is_offline", label: "Server Is Offline", needsValue: false },
];

interface ConditionBuilderProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  depth?: number;
  onRemove?: () => void;
  showRemove?: boolean;
}

function isCondition(item: Condition | ConditionGroup): item is Condition {
  return "field" in item && "operator" in item;
}

export function ConditionBuilder({
  group,
  onChange,
  depth = 0,
  onRemove,
  showRemove = false,
}: ConditionBuilderProps) {
  const maxDepth = 5; // Prevent infinite nesting

  const addCondition = () => {
    const newCondition: Condition = {
      field: "",
      operator: "equals",
      value: "",
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addGroup = () => {
    if (depth >= maxDepth) return;

    const newGroup: ConditionGroup = {
      logic: group.logic === "AND" ? "OR" : "AND", // Alternate logic for clarity
      conditions: [
        {
          field: "",
          operator: "equals",
          value: "",
        },
      ],
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const updateCondition = (index: number, updated: Condition | ConditionGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onChange({
      ...group,
      conditions: newConditions,
    });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const toggleLogic = () => {
    onChange({
      ...group,
      logic: group.logic === "AND" ? "OR" : "AND",
    });
  };

  // Color scheme based on depth
  const getColorClass = () => {
    const colors = [
      "border-blue-300 bg-blue-50/50",
      "border-purple-300 bg-purple-50/50",
      "border-green-300 bg-green-50/50",
      "border-orange-300 bg-orange-50/50",
      "border-pink-300 bg-pink-50/50",
    ];
    return colors[depth % colors.length];
  };

  const getLogicBadgeColor = () => {
    return group.logic === "AND" ? "bg-blue-500" : "bg-purple-500";
  };

  return (
    <Card className={`${getColorClass()} border-2`}>
      <CardContent className="pt-4 space-y-3">
        {/* Group Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              className={`${getLogicBadgeColor()} text-white cursor-pointer hover:opacity-80`}
              onClick={toggleLogic}
            >
              {group.logic}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Click to toggle
            </span>
          </div>
          {showRemove && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-7 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove Group
            </Button>
          )}
        </div>

        {/* Conditions */}
        <div className="space-y-2">
          {group.conditions.map((item, index) => (
            <div key={index}>
              {isCondition(item) ? (
                // Render a single condition
                <div className="flex gap-2 items-start">
                  <Input
                    placeholder="Field name"
                    value={item.field}
                    onChange={(e) =>
                      updateCondition(index, { ...item, field: e.target.value })
                    }
                    className="flex-1"
                  />
                  <Select
                    value={item.operator}
                    onValueChange={(value: ConditionOperator) =>
                      updateCondition(index, { ...item, operator: value })
                    }
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {OPERATORS.find((op) => op.value === item.operator)?.needsValue && (
                    <Input
                      placeholder="Value"
                      value={String(item.value || "")}
                      onChange={(e) =>
                        updateCondition(index, { ...item, value: e.target.value })
                      }
                      className="flex-1"
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // Render a nested group (recursive)
                <ConditionBuilder
                  group={item}
                  onChange={(updated) => updateCondition(index, updated)}
                  depth={depth + 1}
                  onRemove={() => removeCondition(index)}
                  showRemove={true}
                />
              )}
            </div>
          ))}
        </div>

        {/* Add Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondition}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Condition
          </Button>
          {depth < maxDepth && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGroup}
            >
              <Layers className="h-3 w-3 mr-1" />
              Add Group
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
