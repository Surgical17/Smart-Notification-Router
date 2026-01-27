"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { PayloadField } from "@/hooks/use-payload-fields";

interface FieldInputProps {
  value: string;
  onChange: (value: string) => void;
  payloadFields: PayloadField[];
  placeholder?: string;
  className?: string;
}

export function FieldInput({
  value,
  onChange,
  payloadFields,
  placeholder = "Field path (e.g. heartbeat.status)",
  className,
}: FieldInputProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredFields = payloadFields.filter(
    (f) =>
      f.type !== "object" &&
      f.path.toLowerCase().includes((filter || value).toLowerCase())
  );

  const formatValue = (field: PayloadField) => {
    if (field.value === null) return "null";
    if (field.value === undefined) return "undefined";
    if (typeof field.value === "string") {
      const truncated = field.value.length > 30 ? field.value.slice(0, 30) + "..." : field.value;
      return `"${truncated}"`;
    }
    return String(field.value);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <div className="flex">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setFilter(e.target.value);
            if (payloadFields.length > 0) setOpen(true);
          }}
          onFocus={() => {
            if (payloadFields.length > 0) setOpen(true);
          }}
          className={payloadFields.length > 0 ? "rounded-r-none" : ""}
        />
        {payloadFields.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-l-none border-l-0 shrink-0"
            onClick={() => setOpen(!open)}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        )}
      </div>
      {open && filteredFields.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
          {filteredFields.map((field) => (
            <button
              key={field.path}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex justify-between items-center gap-2"
              onClick={() => {
                onChange(field.path);
                setOpen(false);
              }}
            >
              <span className="font-mono text-xs">{field.path}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {formatValue(field)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
