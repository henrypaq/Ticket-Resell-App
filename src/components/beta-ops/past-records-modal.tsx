"use client";

import { useState } from "react";
import { History, ExternalLink } from "lucide-react";
import type { OpsWaitlistEntry } from "@/domains/beta-ops/shared";
import type { PastSellerEntry } from "@/domains/beta-ops/service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteWaitlistEntryAction, deleteLeadAction } from "@/domains/beta-ops/actions";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function contactLabel(entry: OpsWaitlistEntry) {
  if (entry.name) return entry.name;
  if (entry.contactInstagram) return `@${entry.contactInstagram}`;
  if (entry.contactPhone) return entry.contactPhone;
  if (entry.email) return entry.email;
  return "Anonymous";
}

function contactHref(entry: OpsWaitlistEntry) {
  if (entry.contactPhone) {
    return `https://wa.me/${entry.contactPhone.replace(/\D/g, "")}`;
  }
  if (entry.contactInstagram) {
    return `https://instagram.com/${entry.contactInstagram}`;
  }
  if (entry.email) return `mailto:${entry.email}`;
  return null;
}

export function PastOpsModal({
  pastWaitlist,
  pastSellers,
}: {
  pastWaitlist: OpsWaitlistEntry[];
  pastSellers: PastSellerEntry[];
}) {
  const [open, setOpen] = useState(false);
  const totalCount = pastWaitlist.length + pastSellers.length;

  return (
    <div className="mt-12 rounded-lg bg-zinc-950/70 p-3 sm:px-4 sm:py-3 text-zinc-400">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <History className="h-4 w-4 shrink-0 text-zinc-500" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-300">
              Past sellers &amp; waitlists
            </p>
            <p className="text-[11px] text-zinc-500 truncate">
              {totalCount === 0
                ? "No archived records from previous nights"
                : `${pastWaitlist.length} waitlist · ${pastSellers.length} sellers from prior nights`}
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 rounded-md text-xs text-zinc-400 hover:text-zinc-200"
            >
              View past records ({totalCount})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] flex flex-col rounded-xl bg-zinc-900 p-5">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <History className="h-4 w-4 text-zinc-400" />
                Past Sellers &amp; Waitlists
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Archived records from past nights (Thursday, Friday, and earlier). Kept separate
                so tonight&apos;s active operations stay uncluttered.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="waitlist" className="mt-3 flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="waitlist" className="text-xs">
                  Past Waitlist ({pastWaitlist.length})
                </TabsTrigger>
                <TabsTrigger value="sellers" className="text-xs">
                  Past Sellers ({pastSellers.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="waitlist"
                className="mt-3 flex-1 overflow-y-auto pr-1 text-xs"
              >
                {pastWaitlist.length === 0 ? (
                  <p className="py-8 text-center text-zinc-500 text-xs">
                    No past waitlist records.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {pastWaitlist.map((entry) => {
                      const href = contactHref(entry);
                      const label = contactLabel(entry);
                      return (
                        <li
                          key={`${entry.source}-${entry.id}`}
                          className="flex items-center justify-between gap-2.5 rounded-lg bg-zinc-950/50 p-2.5 text-zinc-300"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate font-medium text-zinc-200 hover:underline"
                                >
                                  {label}
                                </a>
                              ) : (
                                <span className="truncate font-medium text-zinc-200">{label}</span>
                              )}
                              <Badge variant="subtle" className="text-[10px] px-1.5 py-0">
                                ×{entry.quantity}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] uppercase px-1.5 py-0">
                                {entry.source}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-[11px] text-zinc-500 truncate">
                              {entry.eventName} · {formatTimestamp(entry.createdAt)}
                            </p>
                          </div>
                          <OpsDeleteButton
                            confirmMessage={`Delete past entry for ${label} from database?`}
                            onConfirm={() => deleteWaitlistEntryAction(entry.source, entry.id)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent
                value="sellers"
                className="mt-3 flex-1 overflow-y-auto pr-1 text-xs"
              >
                {pastSellers.length === 0 ? (
                  <p className="py-8 text-center text-zinc-500 text-xs">
                    No past seller leads.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {pastSellers.map((lead) => {
                      const contact =
                        lead.contactInstagram
                          ? `@${lead.contactInstagram}`
                          : lead.contactPhone || "No contact";
                      return (
                        <li
                          key={lead.id}
                          className="flex items-center justify-between gap-2.5 rounded-lg bg-zinc-950/50 p-2.5 text-zinc-300"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-zinc-200">{contact}</span>
                              <Badge variant="subtle" className="text-[10px] px-1.5 py-0">
                                ×{lead.quantity}
                              </Badge>
                              {lead.paidEach != null && lead.askEach != null && (
                                <span className="text-[11px] text-zinc-400 tabular-nums">
                                  ${lead.askEach.toFixed(0)}
                                </span>
                              )}
                              <Badge variant="secondary" className="text-[10px] uppercase px-1.5 py-0">
                                {lead.status}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-[11px] text-zinc-500 truncate">
                              {lead.eventName} · {formatTimestamp(lead.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {lead.evidenceUrls.map((url, i) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                              >
                                File {lead.evidenceUrls.length > 1 ? i + 1 : ""}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ))}
                            <OpsDeleteButton
                              confirmMessage={`Delete past seller lead ${contact} (${lead.eventName})?`}
                              onConfirm={() => deleteLeadAction(lead.id)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
