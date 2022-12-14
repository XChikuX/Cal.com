import { zodResolver } from "@hookform/resolvers/zod";
import {
  TimeUnit,
  WorkflowActions,
  WorkflowStep,
  WorkflowTemplates,
  WorkflowTriggerEvents,
} from "@prisma/client";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { stringOrNumber } from "@calcom/prisma/zod-utils";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { Alert } from "@calcom/ui/Alert";
import { Icon } from "@calcom/ui/Icon";
import Loader from "@calcom/ui/Loader";
import Shell from "@calcom/ui/Shell";
import { Option } from "@calcom/ui/form/MultiSelectCheckboxes";

import LicenseRequired from "../../common/components/LicenseRequired";
import WorkflowDetailsPage from "../components/WorkflowDetailsPage";

export type FormValues = {
  name: string;
  activeOn: Option[];
  steps: WorkflowStep[];
  trigger: WorkflowTriggerEvents;
  time?: number;
  timeUnit?: TimeUnit;
};

const formSchema = z.object({
  name: z.string(),
  activeOn: z.object({ value: z.string(), label: z.string() }).array(),
  trigger: z.nativeEnum(WorkflowTriggerEvents),
  time: z.number().gte(0).optional(),
  timeUnit: z.nativeEnum(TimeUnit).optional(),
  steps: z
    .object({
      id: z.number(),
      stepNumber: z.number(),
      action: z.nativeEnum(WorkflowActions),
      workflowId: z.number(),
      reminderBody: z.string().nullable(),
      emailSubject: z.string().nullable(),
      template: z.nativeEnum(WorkflowTemplates),
      sendTo: z
        .string()
        .refine((val) => isValidPhoneNumber(val))
        .nullable(),
    })
    .array(),
});

const querySchema = z.object({
  workflow: stringOrNumber,
});

function WorkflowPage() {
  const { t } = useLocale();
  const session = useSession();
  const router = useRouter();
  const me = useMeQuery();
  const isFreeUser = me.data?.plan === "FREE";

  const [editIcon, setEditIcon] = useState(true);
  const [selectedEventTypes, setSelectedEventTypes] = useState<Option[]>([]);
  const [isAllDataLoaded, setIsAllDataLoaded] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });
  const { workflow: workflowId } = router.isReady ? querySchema.parse(router.query) : { workflow: -1 };

  const {
    data: workflow,
    isError,
    error,
    dataUpdatedAt,
  } = trpc.viewer.workflows.get.useQuery(
    { id: +workflowId },
    {
      enabled: router.isReady && !!workflowId,
    }
  );

  useEffect(() => {
    if (workflow && !form.getValues("name")) {
      setSelectedEventTypes(
        workflow.activeOn.map((active) => ({
          value: String(active.eventType.id),
          label: active.eventType.title,
        })) || []
      );
      const activeOn = workflow.activeOn
        ? workflow.activeOn.map((active) => ({
            value: active.eventType.id.toString(),
            label: active.eventType.slug,
          }))
        : undefined;
      form.setValue("name", workflow.name);
      form.setValue("steps", workflow.steps);
      form.setValue("trigger", workflow.trigger);
      form.setValue("time", workflow.time || undefined);
      form.setValue("timeUnit", workflow.timeUnit || undefined);
      form.setValue("activeOn", activeOn || []);
      setIsAllDataLoaded(true);
    }
  }, [dataUpdatedAt]);

  return (
    <Shell
      title="Title"
      heading={
        session.data?.hasValidLicense &&
        isAllDataLoaded && (
          <div className="group relative cursor-pointer" onClick={() => setEditIcon(false)}>
            {editIcon ? (
              <>
                <h1
                  style={{ fontSize: 22, letterSpacing: "-0.0009em" }}
                  className="inline pl-0 text-gray-900 focus:text-black group-hover:text-gray-500">
                  {form.getValues("name") && form.getValues("name") !== ""
                    ? form.getValues("name")
                    : workflow?.name}
                </h1>
                <Icon.FiEdit2 className="ml-1 -mt-1 inline h-4 w-4 text-gray-700 group-hover:text-gray-500" />
              </>
            ) : (
              <div style={{ marginBottom: -11 }}>
                <input
                  type="text"
                  autoFocus
                  style={{ top: -6, fontSize: 22 }}
                  required
                  className="relative h-10 w-full cursor-pointer border-none bg-transparent pl-0 text-gray-900 hover:text-gray-700 focus:text-black focus:outline-none focus:ring-0"
                  placeholder={t("Custom workflow")}
                  {...form.register("name")}
                  defaultValue={workflow?.name}
                  onBlur={() => {
                    setEditIcon(true);
                    form.getValues("name") === "" && form.setValue("name", workflow?.name || "");
                  }}
                />
              </div>
            )}
          </div>
        )
      }>
      <LicenseRequired>
        {isFreeUser ? (
          <Alert className="border " severity="warning" title={t("pro_feature_workflows")} />
        ) : (
          <>
            {!isError ? (
              <>
                {isAllDataLoaded ? (
                  <WorkflowDetailsPage
                    form={form}
                    workflowId={+workflowId}
                    selectedEventTypes={selectedEventTypes}
                    setSelectedEventTypes={setSelectedEventTypes}
                  />
                ) : (
                  <Loader />
                )}
              </>
            ) : (
              <Alert severity="error" title="Something went wrong" message={error.message} />
            )}
          </>
        )}
      </LicenseRequired>
    </Shell>
  );
}

export default WorkflowPage;
