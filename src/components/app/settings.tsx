"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  LifeBuoy,
  LogOut,
  Ticket,
  UserRound,
} from "lucide-react";
import {
  clearBetaBrowserStateAction,
  resetBetaSignupAction,
  submitBetaSupportAction,
  updateBetaContactAction,
  updateBetaNotificationPrefsAction,
  type BetaActionState,
} from "@/domains/beta-signup/actions";
import { SUPPORT_CATEGORIES, type BetaSignupProfile } from "@/domains/beta-signup/shared";
import type { ProfilePrefillData } from "@/domains/beta-quick/shared";
import { SaveProfileCard } from "./save-profile";
import { GoogleContinueButton } from "./google-continue-button";
import { initialsFromName } from "./header";
import { BETA_SOCIALS } from "@/lib/beta-events";
import { COUNTRY_CODES, DEFAULT_COUNTRY_ISO2, countryByIso2 } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { InstagramIcon, SnapchatIcon } from "@/components/icons";
import { CountryCodeSelect } from "@/components/forms/country-code-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PastTicket = {
  key: string;
  kind: "bought" | "sold";
  eventName: string;
  detail: string;
  href: string;
  at: string;
};

type PrefKey = "notifyQueueEmail" | "notifyQueueSms" | "notifyTicketsEmail" | "notifyTicketsSms";
type Prefs = Record<PrefKey, boolean>;

/** Mobile-sized overrides for the ops-density shadcn inputs (16px stops iOS zoom). */
const MOBILE_INPUT = "h-11 rounded-lg bg-zinc-900 text-[16px] ring-1 ring-zinc-800 focus-visible:ring-zinc-500";
const MOBILE_BUTTON = "h-11 w-full rounded-lg text-[14px] font-semibold";

/**
 * Everything behind the account button, grouped by purpose: who you are,
 * how we reach you, how to reach us, and this device. Ops-style black/grey
 * surfaces, sized for a phone.
 *
 * Reachable without a profile. There's no sign-up wall on the app, so plenty
 * of people arrive here having only ever run a buy or sell flow: they get the
 * save-profile card where the editable fields would be, and "contact us"
 * works either way (support messages accept a null member).
 */
export function AppSettings({
  profile,
  prefill,
  pastTickets = [],
  showDevReset = false,
}: {
  profile: BetaSignupProfile | null;
  /** Prefill for the save-profile card, when they have no profile yet. */
  prefill?: ProfilePrefillData | null;
  /** Completed purchases and settled sales, newest first. */
  pastTickets?: PastTicket[];
  showDevReset?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="relative flex flex-col gap-8 pb-10 pt-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to home"
          onClick={() => router.push("/")}
          className="-ml-1.5 h-9 w-9 rounded-full"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-ui text-[22px] font-semibold tracking-tight text-zinc-100">
          Account
        </h1>
      </div>

      <AccountSummary profile={profile} />

      {profile ? (
        <>
          <SettingsSection
            icon={UserRound}
            title="Profile"
            description="How we identify you and send your tickets."
          >
            <PersonalInfoForm profile={profile} />
          </SettingsSection>

          <SettingsSection
            icon={Bell}
            title="Notifications"
            description="Choose where we reach you for each alert."
          >
            <PrefsForm profile={profile} />
          </SettingsSection>
        </>
      ) : (
        <SettingsSection
          icon={UserRound}
          title="Profile"
          description="Your details only live in this browser right now."
        >
          <div className="flex flex-col gap-3">
            <GoogleContinueButton
              nextPath="/setup?intent=buy&next=%2Fsettings"
              label="Sign in with Google"
            />
            <SaveProfileCard
              prefill={{
                name: prefill?.name,
                email: prefill?.email,
                phone: prefill?.phone,
                intent: prefill?.intent,
                eventName: prefill?.eventName,
                referralSource: prefill?.referralSource,
              }}
              heading="Save your profile"
              blurb="Saving lets us reach you about matches and keeps your tickets if you switch devices."
            />
          </div>
        </SettingsSection>
      )}

      <SettingsSection
        icon={LifeBuoy}
        title="Help & support"
        description="We reply within 2 business days."
      >
        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <SupportForm profile={profile} />
          </Card>
          <RowGroup>
            <LinkRow
              href={BETA_SOCIALS.instagram}
              external
              icon={<InstagramIcon className="h-5 w-5" />}
              label="Message us on Instagram"
            />
            <LinkRow
              href={BETA_SOCIALS.snapchat}
              external
              icon={<SnapchatIcon className="h-5 w-5" />}
              label="Add us on Snapchat"
            />
          </RowGroup>
        </div>
      </SettingsSection>

      {pastTickets.length > 0 && (
        <SettingsSection icon={Ticket} title="Past tickets">
          <RowGroup>
            {pastTickets.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-800/50 active:bg-zinc-800/70"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    t.kind === "sold" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-300",
                  )}
                >
                  <Ticket className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-zinc-100">{t.eventName}</span>
                  <span className="block truncate text-[12px] text-zinc-500">{t.detail}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
              </Link>
            ))}
          </RowGroup>
        </SettingsSection>
      )}

      <SettingsSection icon={FileText} title="Legal">
        <RowGroup>
          <LinkRow href="/seller-terms" label="Seller terms" />
        </RowGroup>
      </SettingsSection>

      {(profile || showDevReset) && (
        <SettingsSection icon={LogOut} title="This device">
          <RowGroup>
            {profile && <SignOutRow email={profile.email} />}
            {showDevReset && <DevResetRow />}
          </RowGroup>
        </SettingsSection>
      )}
    </div>
  );
}

function AccountSummary({ profile }: { profile: BetaSignupProfile | null }) {
  const initials = initialsFromName(profile?.name);
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <div
        aria-hidden
        className="font-ui flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[15px] font-semibold text-zinc-200 ring-1 ring-brand/40"
      >
        {initials ?? <UserRound className="h-5 w-5 text-zinc-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-zinc-100">
          {profile?.name || "Guest"}
        </p>
        <p className="truncate text-[12.5px] text-zinc-400">
          {profile?.email || "Not signed in on this device"}
        </p>
      </div>
      <Badge variant={profile ? "default" : "subtle"} className="shrink-0">
        {profile ? "Member" : "Guest"}
      </Badge>
    </Card>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="px-1">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h2>
        {description && <p className="mt-1 text-[12.5px] text-zinc-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** iOS-style grouped list: one card, hairline dividers between rows. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <Card className="divide-y divide-zinc-800/80 overflow-hidden p-0">{children}</Card>;
}

function LinkRow({
  href,
  label,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  external?: boolean;
}) {
  const inner = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-100">{label}</span>
      {external ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
      )}
    </>
  );
  const cls =
    "flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-zinc-800/50 active:bg-zinc-800/70";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

function PersonalInfoForm({ profile }: { profile: BetaSignupProfile }) {
  const parsed = splitPhone(profile.phone);
  const initialDigits = profile.phone.replace(/\D/g, "");
  const initialPhone = initialDigits ? `+${initialDigits}` : "";

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [country, setCountry] = useState(parsed.country);
  const [national, setNational] = useState(parsed.national);
  const [savedName, setSavedName] = useState(profile.name.trim());
  const [savedEmail, setSavedEmail] = useState(profile.email.trim().toLowerCase());
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [state, setState] = useState<BetaActionState>({});
  const [pending, startTransition] = useTransition();

  const dial = countryByIso2(country).dial;
  const digits = national.replace(/\D/g, "");
  const composedPhone = digits ? `+${dial}${digits}` : "";
  const nameValid = name.trim().length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dirty =
    name.trim() !== savedName ||
    email.trim().toLowerCase() !== savedEmail ||
    composedPhone !== savedPhone;
  const canSave = nameValid && emailValid && dirty && !pending;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    const fd = new FormData(e.currentTarget);
    setState({});
    startTransition(async () => {
      const result = await updateBetaContactAction({}, fd);
      setState(result);
      if (result.ok) {
        setSavedName(name.trim());
        setSavedEmail(email.trim().toLowerCase());
        setSavedPhone(composedPhone);
      }
    });
  }

  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="Full name" htmlFor="settings-name">
          <Input
            id="settings-name"
            name="name"
            required
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoCapitalize="words"
            className={MOBILE_INPUT}
          />
        </FormField>
        <FormField
          label="Email"
          htmlFor="settings-email"
          hint="Where we send your tickets and most alerts."
        >
          <Input
            id="settings-email"
            type="email"
            name="email"
            required
            placeholder="jane@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            className={MOBILE_INPUT}
          />
        </FormField>
        <FormField label="Phone (optional)" htmlFor="settings-phone">
          <div className="flex h-11 items-stretch rounded-lg bg-zinc-900 ring-1 ring-zinc-800 focus-within:ring-zinc-500">
            <CountryCodeSelect
              value={country}
              onChange={setCountry}
              className="border-r border-zinc-800 [&>button]:py-0 [&>button]:px-3"
            />
            <input
              id="settings-phone"
              type="tel"
              placeholder={dial === "1" ? "(514) 555-0123" : "Phone number"}
              value={formatPhoneNational(digits, dial)}
              onChange={(e) => setNational(e.target.value.replace(/\D/g, "").slice(0, 15))}
              autoComplete="tel-national"
              inputMode="tel"
              className="min-w-0 flex-1 bg-transparent px-3 text-[16px] text-zinc-100 outline-none placeholder:text-zinc-500"
            />
            <input type="hidden" name="phone" value={composedPhone} />
          </div>
        </FormField>
        <StatusLine state={state} />
        <Button type="submit" disabled={!canSave} className={MOBILE_BUTTON}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}

function PrefsForm({ profile }: { profile: BetaSignupProfile }) {
  const [prefs, setPrefs] = useState<Prefs>({
    notifyQueueEmail: profile.notifyQueueEmail,
    notifyQueueSms: profile.notifyQueueSms,
    notifyTicketsEmail: profile.notifyTicketsEmail,
    notifyTicketsSms: profile.notifyTicketsSms,
  });
  const [state, setState] = useState<BetaActionState>({});
  const [pending, startTransition] = useTransition();

  function toggle(key: PrefKey) {
    const next: Prefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setState({});

    startTransition(async () => {
      const fd = new FormData();
      if (next.notifyQueueEmail) fd.set("notifyQueueEmail", "on");
      if (next.notifyQueueSms) fd.set("notifyQueueSms", "on");
      if (next.notifyTicketsEmail) fd.set("notifyTicketsEmail", "on");
      if (next.notifyTicketsSms) fd.set("notifyTicketsSms", "on");

      const result = await updateBetaNotificationPrefsAction({}, fd);
      if (result.error) {
        setPrefs(prefs);
        setState({ error: result.error });
        return;
      }
      setState({ ok: true, message: result.message ?? "Saved." });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <PrefGroup
        title="You're #1 in the waitlist"
        description="When a ticket is held for you."
        emailChecked={prefs.notifyQueueEmail}
        smsChecked={prefs.notifyQueueSms}
        disabled={pending}
        onToggleEmail={() => toggle("notifyQueueEmail")}
        onToggleSms={() => toggle("notifyQueueSms")}
      />
      <PrefGroup
        title="Tickets available"
        description="When tickets open up for events you follow."
        emailChecked={prefs.notifyTicketsEmail}
        smsChecked={prefs.notifyTicketsSms}
        disabled={pending}
        onToggleEmail={() => toggle("notifyTicketsEmail")}
        onToggleSms={() => toggle("notifyTicketsSms")}
      />
      <div className="min-h-[18px] px-1">
        {pending ? (
          <p className="text-[12.5px] text-zinc-500">Saving…</p>
        ) : (
          <StatusLine state={state} />
        )}
      </div>
    </div>
  );
}

function PrefGroup({
  title,
  description,
  emailChecked,
  smsChecked,
  disabled,
  onToggleEmail,
  onToggleSms,
}: {
  title: string;
  description: string;
  emailChecked: boolean;
  smsChecked: boolean;
  disabled: boolean;
  onToggleEmail: () => void;
  onToggleSms: () => void;
}) {
  return (
    <RowGroup>
      <div className="px-4 py-3">
        <p className="text-[14px] font-medium text-zinc-100">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-zinc-400">{description}</p>
      </div>
      <SwitchRow label="Email" checked={emailChecked} disabled={disabled} onToggle={onToggleEmail} />
      <SwitchRow label="SMS" checked={smsChecked} disabled={disabled} onToggle={onToggleSms} />
    </RowGroup>
  );
}

function SwitchRow({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 px-4">
      <span className="text-[14px] text-zinc-300">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={label}
      />
    </div>
  );
}

function SupportForm({ profile }: { profile: BetaSignupProfile | null }) {
  const [state, action, pending] = useActionState(submitBetaSupportAction, {} as BetaActionState);
  const [email, setEmail] = useState(profile?.email ?? "");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");

  const canSend =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    category !== "" &&
    message.trim().length >= 10;

  if (state.ok) {
    return (
      <p role="status" className="text-[14px] leading-relaxed text-emerald-400">
        {state.message ?? "We'll get back to you within 2 business days."}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormField label="Your email" htmlFor="help-email">
        <Input
          id="help-email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@email.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          className={MOBILE_INPUT}
        />
      </FormField>

      <FormField label="Topic" htmlFor="help-category">
        <div className="relative">
          <select
            id="help-category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={cn(
              "flex w-full appearance-none px-3 pr-9 text-zinc-100 outline-none",
              MOBILE_INPUT,
              category === "" && "text-zinc-500",
            )}
          >
            <option value="" disabled className="bg-zinc-900 text-zinc-500">
              Choose a topic
            </option>
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} className="bg-zinc-900 text-zinc-100">
                {c.label}
              </option>
            ))}
          </select>
          <ChevronRight
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-zinc-500"
          />
        </div>
      </FormField>

      <FormField label="Message" htmlFor="help-message">
        <Textarea
          id="help-message"
          name="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's going on?"
          className="resize-none rounded-lg bg-zinc-900 px-3 py-2.5 text-[16px] ring-1 ring-zinc-800 focus-visible:ring-zinc-500"
        />
      </FormField>

      {state.error && (
        <p role="alert" className="text-[13px] text-red-400">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        variant="secondary"
        disabled={pending || !canSend}
        className={MOBILE_BUTTON}
      >
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

/**
 * Forgets this browser's profile and flow cookies. Nothing is deleted
 * server-side — signing back in with Google or the same email relinks.
 */
function SignOutRow({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    start(async () => {
      const result = await clearBetaBrowserStateAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-zinc-800/50 active:bg-zinc-800/70"
        >
          <LogOut className="h-4 w-4 shrink-0 text-red-400" />
          <span className="flex-1 text-[14px] font-medium text-red-400">Sign out on this device</span>
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Sign out on this device?</DialogTitle>
          <DialogDescription>
            Your tickets and waitlist spots stay saved. Sign back in with Google or{" "}
            <span className="text-zinc-200">{email}</span> to see them again.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-[13px] text-red-400">
            {error}
          </p>
        )}
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
            className={MOBILE_BUTTON}
          >
            {pending ? "Signing out…" : "Sign out"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} className={MOBILE_BUTTON}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dev-only: forget this browser's member so the join flow runs again. */
function DevResetRow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setError(null);
        start(async () => {
          const result = await resetBetaSignupAction();
          if (result.error) {
            setError(result.error);
            return;
          }
          router.replace("/");
          router.refresh();
        });
      }}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-zinc-800/50 disabled:opacity-60"
    >
      <span className="text-[14px] text-zinc-400">
        {pending ? "Resetting…" : "Back to start"}
      </span>
      {error ? (
        <span className="text-[12px] text-red-400">{error}</span>
      ) : (
        <Badge variant="subtle" className="font-mono text-[10px]">
          dev
        </Badge>
      )}
    </button>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[12px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function StatusLine({ state }: { state: BetaActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-[13px] text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="text-[13px] text-emerald-400">
        {state.message}
      </p>
    );
  }
  return null;
}

function splitPhone(e164: string): { country: string; national: string } {
  const digits = e164.replace(/\D/g, "");
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial) && digits.length > c.dial.length) {
      if (c.dial === "1") return { country: "CA", national: digits.slice(1) };
      return { country: c.iso2, national: digits.slice(c.dial.length) };
    }
  }
  return { country: DEFAULT_COUNTRY_ISO2, national: digits };
}
