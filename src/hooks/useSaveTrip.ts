import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { DayPlan, TripConfig } from "@/data/demoTrip";

interface Preferences {
  interests: string[];
  pace: string;
  mustSees: string;
}

export function useSaveTrip() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const saveTrip = useCallback(
    async (
      tripConfig: TripConfig,
      itinerary: DayPlan[],
      preferences?: Preferences,
      existingTripId?: string
    ): Promise<string | null> => {
      if (!user) return null;

      setIsSaving(true);
      const title = `${tripConfig.from} → ${tripConfig.to}`;

      try {
        if (existingTripId) {
          const { error } = await supabase
            .from("trips")
            .update({
              title,
              trip_config: tripConfig as any,
              itinerary: itinerary as any,
              preferences: preferences as any ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingTripId);

          if (error) throw error;
          toast.success("Trip updated!");
          return existingTripId;
        } else {
          const { data, error } = await supabase
            .from("trips")
            .insert({
              user_id: user.id,
              title,
              trip_config: tripConfig as any,
              itinerary: itinerary as any,
              preferences: preferences as any ?? null,
            })
            .select("id")
            .single();

          if (error) throw error;
          toast.success("Trip saved!");
          return data.id;
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to save trip");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [user]
  );

  return { saveTrip, isSaving };
}
