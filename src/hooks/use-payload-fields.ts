import { useState, useEffect } from "react";

export interface PayloadField {
  path: string;
  value: unknown;
  type: string;
}

export function usePayloadFields(webhookId: string) {
  const [payloadFields, setPayloadFields] = useState<PayloadField[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);

  useEffect(() => {
    if (!webhookId || fieldsLoaded) return;

    fetch(`/api/webhooks/${webhookId}/payload-fields`)
      .then((res) => res.json())
      .then((data) => {
        if (data.fields) {
          setPayloadFields(data.fields);
        }
      })
      .catch(() => {
        // Silently fail - fields are optional enhancement
      })
      .finally(() => setFieldsLoaded(true));
  }, [webhookId, fieldsLoaded]);

  return { payloadFields, fieldsLoaded };
}
