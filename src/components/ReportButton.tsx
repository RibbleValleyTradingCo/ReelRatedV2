import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { notifyAdmins } from "@/lib/notifications";
import { useRateLimit, formatResetTime } from "@/hooks/useRateLimit";
import type { Database } from "@/integrations/supabase/types";
import { isRateLimitError, getRateLimitMessage } from "@/lib/rateLimit";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

interface ReportButtonProps {
  targetType: "catch" | "comment" | "profile";
  targetId: string;
  label?: string;
  className?: string;
}

export const ReportButton = ({ targetType, targetId, label = "Report", className }: ReportButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Rate limiting: max 5 reports per hour
  const { checkLimit, isLimited, attemptsRemaining, resetIn } = useRateLimit({
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    storageKey: 'report-submit-limit',
    onLimitExceeded: () => {
      const resetTime = formatResetTime(resetIn);
      toast.error(`Rate limit exceeded. You can only submit 5 reports per hour. Try again in ${resetTime}.`);
    },
  });

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to report");
      navigate("/auth");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please describe the issue");
      return;
    }

    // Check rate limit (client-side)
    if (!checkLimit()) {
      return; // Rate limited - toast already shown by onLimitExceeded
    }

    setSubmitting(true);
    const { data: reportRecord, error } = await supabase.rpc("create_report_with_rate_limit", {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason.trim(),
      p_details: null,
    });

    if (error) {
      console.error("Failed to submit report", error);
      if (isRateLimitError(error)) {
        toast.error(getRateLimitMessage(error));
      } else {
        toast.error("Unable to submit report. Please try again.");
      }
    } else {
      const insertedReport = reportRecord as ReportRow | null;
      toast.success("Report submitted");
      setOpen(false);
      setReason("");
      void notifyAdmins({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        report_id: insertedReport?.id,
        reason: reason.trim(),
        message: `${user.user_metadata?.username ?? user.email ?? "Someone"} reported a ${targetType}.`,
      });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Let us know what doesn't look right."
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || isLimited}
            title={isLimited ? `Rate limited. Reset in ${formatResetTime(resetIn)}` : ''}
          >
            {submitting
              ? "Sending…"
              : isLimited
              ? `Limited (${formatResetTime(resetIn)})`
              : attemptsRemaining < 5
              ? `Submit report (${attemptsRemaining} left)`
              : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportButton;
