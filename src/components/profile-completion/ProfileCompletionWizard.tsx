"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { OPEN_PROFILE_COMPLETION_EVENT } from "@/lib/profile-completion-events";
import { PROFILE_COMPLETION_STEPS, type ProfileCompletionStep } from "@/lib/profile-completion";
import { formatPhoneInput } from "@/lib/profile-phone";
import { MENS_SHOE_SIZE_OPTIONS, TOP_SIZE_OPTIONS, WOMENS_SHOE_SIZE_OPTIONS } from "@/lib/profile-sizing";
import {
  PROFILE_COMPLETION_QUERY_KEY,
  type ProfileCompletionResponse,
  useProfileCompletion,
} from "@/hooks/use-profile-completion";

const STEP_COPY: Record<ProfileCompletionStep, { title: string; description: string }> = {
  EMAIL: {
    title: "Confirm your email addresses",
    description: "Your campus email is also your Gear Tracker login. Add your required Athletics address.",
  },
  PHONES: {
    title: "Add your phone numbers",
    description: "Identify any number already on your account, then add the other contact number.",
  },
  WISCARD: {
    title: "Link your Wiscard",
    description: "Type the card number and issue code printed for your card. This is used for kiosk identification.",
  },
  APPAREL: {
    title: "Add your apparel sizes",
    description: "Choose the sizing systems that make clothing and shoe orders unambiguous.",
  },
};

type LegacyPhoneType = "PERSONAL" | "WORK" | "";
type ApiEnvelope = { data?: ProfileCompletionResponse };

function isKnownOption(value: string | null, options: string[]) {
  return Boolean(value && options.includes(value));
}

export function ProfileCompletionWizard() {
  const queryClient = useQueryClient();
  const { data } = useProfileCompletion();
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ProfileCompletionStep>("EMAIL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const autoOpenedRef = useRef(false);
  const closeWithoutSnoozeRef = useRef(false);
  const manualReviewRef = useRef(false);

  const [athleticsEmail, setAthleticsEmail] = useState("");
  const [legacyPhoneType, setLegacyPhoneType] = useState<LegacyPhoneType>("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [noWorkPhone, setNoWorkPhone] = useState(false);
  const [wiscardCardNumber, setWiscardCardNumber] = useState("");
  const [wiscardIssueCode, setWiscardIssueCode] = useState("");
  const [topSizeFit, setTopSizeFit] = useState<"UNISEX" | "WOMENS" | "MENS" | "">("");
  const [topSizeChoice, setTopSizeChoice] = useState("");
  const [topSizeOther, setTopSizeOther] = useState("");
  const [shoeSizeSystem, setShoeSizeSystem] = useState<"US_WOMENS" | "US_MENS" | "">("");
  const [shoeSizeChoice, setShoeSizeChoice] = useState("");
  const [shoeSizeOther, setShoeSizeOther] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!data) return;
    const profile = data.profile;
    setAthleticsEmail(profile.athleticsEmail ?? "");
    setPersonalPhone(profile.personalPhone ?? "");
    setWorkPhone(profile.workPhone ?? "");
    setNoWorkPhone(profile.workPhoneNotApplicable);
    setLegacyPhoneType(
      profile.phone && profile.phone === profile.personalPhone
        ? "PERSONAL"
        : profile.phone && profile.phone === profile.workPhone
          ? "WORK"
          : "",
    );
    setWiscardCardNumber(profile.wiscardCardNumber ?? "");
    setWiscardIssueCode(profile.wiscardIssueCode ?? "");
    setTopSizeFit(profile.topSizeFit ?? "");
    if (isKnownOption(profile.topSize, [...TOP_SIZE_OPTIONS])) {
      setTopSizeChoice(profile.topSize ?? "");
      setTopSizeOther("");
    } else if (profile.topSize) {
      setTopSizeChoice("OTHER");
      setTopSizeOther(profile.topSize);
    }
    setShoeSizeSystem(profile.shoeSizeSystem ?? "");
    const shoeOptions = profile.shoeSizeSystem === "US_MENS" ? MENS_SHOE_SIZE_OPTIONS : WOMENS_SHOE_SIZE_OPTIONS;
    if (isKnownOption(profile.shoeSize, shoeOptions)) {
      setShoeSizeChoice(profile.shoeSize ?? "");
      setShoeSizeOther("");
    } else if (profile.shoeSize) {
      setShoeSizeChoice("OTHER");
      setShoeSizeOther(profile.shoeSize);
    }
  }, [data]);

  useEffect(() => {
    if (!isDesktop || !data?.completion.shouldPrompt || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    setStep(data.completion.firstIncompleteStep ?? "EMAIL");
    setOpen(true);
  }, [data, isDesktop]);

  useEffect(() => {
    const openWizard = () => {
      if (!isDesktop || !data) return;
      closeWithoutSnoozeRef.current = false;
      manualReviewRef.current = data.completion.isComplete;
      setError("");
      setStep(data.completion.firstIncompleteStep ?? "EMAIL");
      setOpen(true);
    };
    window.addEventListener(OPEN_PROFILE_COMPLETION_EVENT, openWizard);
    return () => window.removeEventListener(OPEN_PROFILE_COMPLETION_EVENT, openWizard);
  }, [data, isDesktop]);

  const stepIndex = PROFILE_COMPLETION_STEPS.indexOf(step);
  const shoeOptions = shoeSizeSystem === "US_MENS" ? MENS_SHOE_SIZE_OPTIONS : WOMENS_SHOE_SIZE_OPTIONS;
  const copy = STEP_COPY[step];
  const legacyPhone = data?.profile.phone?.trim() ?? "";
  const needsLegacyClassification = Boolean(
    legacyPhone && !data?.profile.personalPhone && !data?.profile.workPhone,
  );

  const canContinue = useMemo(() => {
    if (!data) return false;
    if (step === "EMAIL") {
      return data.profile.email.toLowerCase().endsWith("@wisc.edu")
        && athleticsEmail.trim().toLowerCase().endsWith("@athletics.wisc.edu");
    }
    if (step === "PHONES") {
      return (!needsLegacyClassification || Boolean(legacyPhoneType))
        && personalPhone.replace(/\D/g, "").length === 10
        && (noWorkPhone || workPhone.replace(/\D/g, "").length === 10);
    }
    if (step === "WISCARD") {
      return /^\d{4,32}$/.test(wiscardCardNumber.trim()) && /^\d{1,8}$/.test(wiscardIssueCode.trim());
    }
    const topSize = topSizeChoice === "OTHER" ? topSizeOther.trim() : topSizeChoice;
    const shoeSize = shoeSizeChoice === "OTHER" ? shoeSizeOther.trim() : shoeSizeChoice;
    return Boolean(topSizeFit && topSize && shoeSizeSystem && shoeSize);
  }, [
    athleticsEmail,
    data,
    legacyPhoneType,
    needsLegacyClassification,
    noWorkPhone,
    personalPhone,
    shoeSizeChoice,
    shoeSizeOther,
    shoeSizeSystem,
    step,
    topSizeChoice,
    topSizeFit,
    topSizeOther,
    wiscardCardNumber,
    wiscardIssueCode,
    workPhone,
  ]);

  async function patchCompletion(body: Record<string, unknown>) {
    const response = await fetch("/api/me/profile-completion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (handleAuthRedirect(response)) return null;
    if (!response.ok) throw new Error(await parseErrorMessage(response, "Profile details were not saved."));
    const json = await parseJsonSafely<ApiEnvelope>(response);
    if (!json?.data) throw new Error("Profile details were saved, but the response could not be read. Refresh before continuing.");
    queryClient.setQueryData(PROFILE_COMPLETION_QUERY_KEY, json.data);
    return json.data;
  }

  async function saveCurrentStep() {
    if (!canContinue || saving) return;
    setSaving(true);
    setError("");
    try {
      const body = step === "EMAIL"
        ? { step, athleticsEmail: athleticsEmail.trim() }
        : step === "PHONES"
          ? {
              step,
              personalPhone: personalPhone.trim(),
              workPhone: noWorkPhone ? null : workPhone.trim(),
              workPhoneNotApplicable: noWorkPhone,
            }
          : step === "WISCARD"
            ? {
                step,
                wiscardCardNumber: wiscardCardNumber.trim(),
                wiscardIssueCode: wiscardIssueCode.trim(),
              }
            : {
                step,
                topSizeFit,
                topSize: topSizeChoice === "OTHER" ? topSizeOther.trim() : topSizeChoice,
                shoeSizeSystem,
                shoeSize: shoeSizeChoice === "OTHER" ? shoeSizeOther.trim() : shoeSizeChoice,
              };
      const updated = await patchCompletion(body);
      if (!updated) return;
      if (updated.completion.isComplete && (!manualReviewRef.current || step === "APPAREL")) {
        closeWithoutSnoozeRef.current = true;
        manualReviewRef.current = false;
        setOpen(false);
        toast.success("Profile complete");
        return;
      }
      setStep(
        manualReviewRef.current
          ? PROFILE_COMPLETION_STEPS[Math.min(stepIndex + 1, 3)]!
          : updated.completion.firstIncompleteStep ?? PROFILE_COMPLETION_STEPS[Math.min(stepIndex + 1, 3)]!,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile details were not saved.");
    } finally {
      setSaving(false);
    }
  }

  async function snooze() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await patchCompletion({ step: "SNOOZE" });
      closeWithoutSnoozeRef.current = true;
      setOpen(false);
      toast.message("We’ll remind you tomorrow.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The reminder could not be postponed.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    if (saving) return;
    if (closeWithoutSnoozeRef.current) {
      closeWithoutSnoozeRef.current = false;
      setOpen(false);
      return;
    }
    void snooze();
  }

  function classifyLegacyPhone(value: string) {
    if (value !== "PERSONAL" && value !== "WORK") return;
    setLegacyPhoneType(value);
    if (value === "PERSONAL") {
      setPersonalPhone(legacyPhone);
      if (workPhone === legacyPhone) setWorkPhone("");
    } else {
      setWorkPhone(legacyPhone);
      setNoWorkPhone(false);
      if (personalPhone === legacyPhone) setPersonalPhone("");
    }
  }

  if (!isDesktop || !data) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader className="flex-col items-start gap-3 pr-14">
          <div className="flex w-full items-center justify-between gap-4">
            <Badge variant="orange" size="sm">Step {stepIndex + 1} of 4</Badge>
            <span className="text-xs text-muted-foreground">
              {data.completion.completedCount} of {data.completion.totalCount} details complete
            </span>
          </div>
          <Progress value={(stepIndex + 1) * 25} aria-label={`Step ${stepIndex + 1} of 4`} />
          <div className="flex flex-col gap-1">
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="flex min-h-[300px] flex-col gap-5 py-5">
          {step === "EMAIL" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-completion-campus-email">Campus email and site login</Label>
                <Input id="profile-completion-campus-email" type="email" value={data.profile.email} disabled />
                <p className="text-xs text-muted-foreground">Your site login must use your @wisc.edu address.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-completion-athletics-email">Athletics email</Label>
                <Input
                  id="profile-completion-athletics-email"
                  name="athleticsEmail"
                  type="email"
                  autoComplete="email"
                  value={athleticsEmail}
                  onChange={(event) => { setAthleticsEmail(event.target.value); setError(""); }}
                  placeholder="name@athletics.wisc.edu"
                  aria-invalid={Boolean(athleticsEmail && !athleticsEmail.toLowerCase().endsWith("@athletics.wisc.edu"))}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">Everyone should enter their @athletics.wisc.edu address.</p>
              </div>
              {!data.profile.email.toLowerCase().endsWith("@wisc.edu") && (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertDescription>Your current login is not a @wisc.edu address. Ask an administrator to correct it before completing this step.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === "PHONES" && (
            <div className="flex flex-col gap-5">
              {needsLegacyClassification && (
                <div className="flex flex-col gap-2">
                  <Label id="legacy-phone-type-label">We already have {legacyPhone}. Which number is it?</Label>
                  <ToggleGroup
                    type="single"
                    value={legacyPhoneType}
                    onValueChange={classifyLegacyPhone}
                    aria-labelledby="legacy-phone-type-label"
                    className="self-start"
                  >
                    <ToggleGroupItem value="PERSONAL">Personal</ToggleGroupItem>
                    <ToggleGroupItem value="WORK">Work</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-personal-phone">Personal phone</Label>
                  <Input
                    id="profile-completion-personal-phone"
                    name="personalPhone"
                    type="tel"
                    autoComplete="tel"
                    value={personalPhone}
                    onChange={(event) => { setPersonalPhone(formatPhoneInput(event.target.value)); setError(""); }}
                    placeholder="(XXX) XXX-XXXX"
                    disabled={saving}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-work-phone">Work phone</Label>
                  <Input
                    id="profile-completion-work-phone"
                    name="workPhone"
                    type="tel"
                    autoComplete="work tel"
                    value={workPhone}
                    onChange={(event) => { setWorkPhone(formatPhoneInput(event.target.value)); setNoWorkPhone(false); setError(""); }}
                    placeholder="(XXX) XXX-XXXX"
                    disabled={saving || noWorkPhone}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="profile-completion-no-work-phone"
                  checked={noWorkPhone}
                  onCheckedChange={(checked) => { setNoWorkPhone(checked === true); if (checked) setWorkPhone(""); }}
                  disabled={saving}
                />
                <Label htmlFor="profile-completion-no-work-phone" className="font-normal">I don’t have a work phone</Label>
              </div>
            </div>
          )}

          {step === "WISCARD" && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-wiscard-number">Wiscard number</Label>
                  <Input
                    id="profile-completion-wiscard-number"
                    name="wiscardCardNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    value={wiscardCardNumber}
                    onChange={(event) => setWiscardCardNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="XXXXXXXXXX"
                    disabled={saving}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-wiscard-issue">Issue code</Label>
                  <Input
                    id="profile-completion-wiscard-issue"
                    name="wiscardIssueCode"
                    inputMode="numeric"
                    autoComplete="off"
                    value={wiscardIssueCode}
                    onChange={(event) => setWiscardIssueCode(event.target.value.replace(/\D/g, "").slice(0, 1))}
                    placeholder="X"
                    disabled={saving}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Issue code can be found in the bottom right of your Wiscard. Gear Tracker combines both values into the exact kiosk lookup value.</p>
            </div>
          )}

          {step === "APPAREL" && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-top-fit">Clothing fit</Label>
                  <Select value={topSizeFit} onValueChange={(value) => setTopSizeFit(value as typeof topSizeFit)} disabled={saving}>
                    <SelectTrigger id="profile-completion-top-fit"><SelectValue placeholder="Select fit" /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem value="UNISEX">Unisex</SelectItem>
                      <SelectItem value="WOMENS">Women’s</SelectItem>
                      <SelectItem value="MENS">Men’s</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-top-size">Top size</Label>
                  <Select value={topSizeChoice} onValueChange={setTopSizeChoice} disabled={saving}>
                    <SelectTrigger id="profile-completion-top-size"><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      {TOP_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </div>
              </div>
              {topSizeChoice === "OTHER" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-top-other">Other top size</Label>
                  <Input id="profile-completion-top-other" value={topSizeOther} onChange={(event) => setTopSizeOther(event.target.value)} maxLength={40} disabled={saving} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-shoe-system">Shoe sizing</Label>
                  <Select
                    value={shoeSizeSystem}
                    onValueChange={(value) => { setShoeSizeSystem(value as typeof shoeSizeSystem); setShoeSizeChoice(""); setShoeSizeOther(""); }}
                    disabled={saving}
                  >
                    <SelectTrigger id="profile-completion-shoe-system"><SelectValue placeholder="Select system" /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem value="US_WOMENS">Women’s</SelectItem>
                      <SelectItem value="US_MENS">Men’s</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-shoe-size">Shoe size</Label>
                  <Select value={shoeSizeChoice} onValueChange={setShoeSizeChoice} disabled={saving || !shoeSizeSystem}>
                    <SelectTrigger id="profile-completion-shoe-size"><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      {shoeOptions.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </div>
              </div>
              {shoeSizeChoice === "OTHER" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-completion-shoe-other">Other shoe size</Label>
                  <Input id="profile-completion-shoe-other" value={shoeSizeOther} onChange={(event) => setShoeSizeOther(event.target.value)} maxLength={40} disabled={saving} />
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </DialogBody>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="ghost" onClick={snooze} disabled={saving} className="mr-auto">
            Remind me tomorrow
          </Button>
          {stepIndex > 0 && (
            <Button type="button" variant="outline" onClick={() => { setStep(PROFILE_COMPLETION_STEPS[stepIndex - 1]!); setError(""); }} disabled={saving}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back
            </Button>
          )}
          <Button type="button" onClick={saveCurrentStep} disabled={saving || !canContinue}>
            {saving ? <Spinner data-icon="inline-start" /> : step === "APPAREL" ? <CheckIcon data-icon="inline-start" /> : null}
            {step === "APPAREL" ? "Finish" : "Continue"}
            {!saving && step !== "APPAREL" && <ArrowRightIcon data-icon="inline-end" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
