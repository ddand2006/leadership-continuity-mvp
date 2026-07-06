"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileDropInput } from "@/components/file-drop-input";
import { parseCharacteristicsTextarea } from "@/lib/role-characteristics";

type RoleOption = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  status: "draft" | "active";
  primaryMentorProfileId: string | null;
  idealCompetencyCount: number;
  roleCompositeCount: number;
  compositeDocumentSource: "generated" | "manual" | null;
  compositeDocumentFileName: string | null;
  talents: string[];
  skills: string[];
  behaviors: string[];
};

type SharedLibraryItem = {
  id: string;
  category: "talent" | "skill" | "behavior";
  characteristic: string;
};

type RoleManagementPanelProps = {
  roles: RoleOption[];
  sharedLibrary: SharedLibraryItem[];
  canGenerateComposite: boolean;
  initialSelectedRoleId?: string | null;
  mode?: "create" | "import" | "composite";
};

export function RoleManagementPanel({
  roles,
  sharedLibrary,
  canGenerateComposite,
  initialSelectedRoleId = null,
  mode = "create",
}: RoleManagementPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uploadCharacteristicsFormRef = useRef<HTMLFormElement>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [uploadCharacteristicsError, setUploadCharacteristicsError] = useState<string | null>(null);
  const [uploadCharacteristicsSuccess, setUploadCharacteristicsSuccess] = useState<string | null>(null);
  const [editCompetenciesError, setEditCompetenciesError] = useState<string | null>(null);
  const [editCompetenciesSuccess, setEditCompetenciesSuccess] = useState<string | null>(null);
  const [addLibraryCompetencyError, setAddLibraryCompetencyError] = useState<string | null>(null);
  const [addLibraryCompetencySuccess, setAddLibraryCompetencySuccess] = useState<string | null>(null);
  const [generateCompositeError, setGenerateCompositeError] = useState<string | null>(null);
  const [generateCompositeSuccess, setGenerateCompositeSuccess] = useState<string | null>(null);
  const [downloadCompositeError, setDownloadCompositeError] = useState<string | null>(null);
  const [uploadCompositeDocumentError, setUploadCompositeDocumentError] = useState<string | null>(null);
  const [uploadCompositeDocumentSuccess, setUploadCompositeDocumentSuccess] = useState<string | null>(null);
  const [uploadCharacteristicsResetKey, setUploadCharacteristicsResetKey] = useState(0);
  const [uploadCompositeDocumentResetKey, setUploadCompositeDocumentResetKey] =
    useState(0);
  const initialEditorRole =
    roles.find((role) => role.id === initialSelectedRoleId) ?? null;
  const [editorRoleId, setEditorRoleId] = useState(initialSelectedRoleId ?? "");
  const [title, setTitle] = useState(initialEditorRole?.title ?? "");
  const [department, setDepartment] = useState(initialEditorRole?.department ?? "");
  const [description, setDescription] = useState(
    initialEditorRole?.description ?? "",
  );
  const [newLibraryCompetency, setNewLibraryCompetency] = useState("");
  const [status, setStatus] = useState<"draft" | "active">(
    initialEditorRole?.status ?? "draft",
  );
  const [mentorProfileId, setMentorProfileId] = useState(
    initialEditorRole?.primaryMentorProfileId ?? "",
  );
  const [talentsValue, setTalentsValue] = useState(
    initialEditorRole?.talents.join("\n") ?? "",
  );
  const [skillsValue, setSkillsValue] = useState(
    initialEditorRole?.skills.join("\n") ?? "",
  );
  const [behaviorsValue, setBehaviorsValue] = useState(
    initialEditorRole?.behaviors.join("\n") ?? "",
  );
  const [editTalentsValue, setEditTalentsValue] = useState("");
  const [editSkillsValue, setEditSkillsValue] = useState("");
  const [editBehaviorsValue, setEditBehaviorsValue] = useState("");
  const [selectedCompetencyRoleId, setSelectedCompetencyRoleId] = useState(
    initialSelectedRoleId ?? "",
  );
  const [sharedLibraryOverrides, setSharedLibraryOverrides] = useState<
    SharedLibraryItem[]
  >([]);
  const [isEditingCompetencies, setIsEditingCompetencies] = useState(false);
  const [isCreatePending, startCreateTransition] = useTransition();
  const [isUploadCharacteristicsPending, startUploadCharacteristicsTransition] = useTransition();
  const [isEditCompetenciesPending, startEditCompetenciesTransition] = useTransition();
  const [isAddLibraryCompetencyPending, startAddLibraryCompetencyTransition] =
    useTransition();
  const [isGenerateCompositePending, startGenerateCompositeTransition] = useTransition();
  const [isDownloadCompositePending, startDownloadCompositeTransition] = useTransition();
  const [isUploadCompositeDocumentPending, startUploadCompositeDocumentTransition] =
    useTransition();
  const selectedEditorRole =
    roles.find((role) => role.id === editorRoleId) ?? null;
  const selectedCompetencyRole =
    roles.find((role) => role.id === selectedCompetencyRoleId) ?? null;
  const sharedLibraryItems = [...sharedLibraryOverrides, ...sharedLibrary].filter(
    (item, index, items) =>
      items.findIndex(
        (candidate) =>
          candidate.category === item.category &&
          candidate.characteristic.toLowerCase() ===
            item.characteristic.toLowerCase(),
      ) === index,
  );
  const sharedLibraryByCategory = {
    talents: sharedLibraryItems.filter((item) => item.category === "talent"),
    skills: sharedLibraryItems.filter((item) => item.category === "skill"),
    behaviors: sharedLibraryItems.filter((item) => item.category === "behavior"),
  };

  function openCompetencyImport() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("mode", "import");

    if (editorRoleId) {
      nextParams.set("roleId", editorRoleId);
    } else if (selectedCompetencyRoleId) {
      nextParams.set("roleId", selectedCompetencyRoleId);
    } else {
      nextParams.delete("roleId");
    }

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function openCompositePage() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("mode", "composite");

    if (selectedCompetencyRoleId) {
      nextParams.set("roleId", selectedCompetencyRoleId);
    } else if (editorRoleId) {
      nextParams.set("roleId", editorRoleId);
    } else {
      nextParams.delete("roleId");
    }

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function applyEditorRole(nextRoleId: string) {
    setEditorRoleId(nextRoleId);
    const nextRole = roles.find((role) => role.id === nextRoleId) ?? null;

    if (!nextRole) {
      setTitle("");
      setDepartment("");
      setDescription("");
      setStatus("draft");
      setMentorProfileId("");
      setTalentsValue("");
      setSkillsValue("");
      setBehaviorsValue("");
      return;
    }

    setTitle(nextRole.title);
    setDepartment(nextRole.department ?? "");
    setDescription(nextRole.description ?? "");
    setStatus(nextRole.status);
    setMentorProfileId(nextRole.primaryMentorProfileId ?? "");
    setTalentsValue(nextRole.talents.join("\n"));
    setSkillsValue(nextRole.skills.join("\n"));
    setBehaviorsValue(nextRole.behaviors.join("\n"));
  }

  function toggleLibraryCharacteristic(
    category: "talent" | "skill" | "behavior",
    characteristic: string,
  ) {
    const getValue = () => {
      if (category === "talent") {
        return talentsValue;
      }

      if (category === "skill") {
        return skillsValue;
      }

      return behaviorsValue;
    };

    const setValue = (nextValue: string) => {
      if (category === "talent") {
        setTalentsValue(nextValue);
        return;
      }

      if (category === "skill") {
        setSkillsValue(nextValue);
        return;
      }

      setBehaviorsValue(nextValue);
    };

    const currentItems = parseCharacteristicsTextarea(category, getValue()).map(
      (item) => item.characteristic,
    );
    const hasItem = currentItems.some(
      (item) => item.toLowerCase() === characteristic.toLowerCase(),
    );
    const nextItems = hasItem
      ? currentItems.filter((item) => item.toLowerCase() !== characteristic.toLowerCase())
      : [...currentItems, characteristic];

    setValue(nextItems.join("\n"));
  }

  function addCharacteristicToEditor(
    category: "talent" | "skill" | "behavior",
    characteristic: string,
  ) {
    const getValue = () => {
      if (category === "talent") {
        return talentsValue;
      }

      if (category === "skill") {
        return skillsValue;
      }

      return behaviorsValue;
    };

    const setValue = (nextValue: string) => {
      if (category === "talent") {
        setTalentsValue(nextValue);
        return;
      }

      if (category === "skill") {
        setSkillsValue(nextValue);
        return;
      }

      setBehaviorsValue(nextValue);
    };

    const currentItems = parseCharacteristicsTextarea(category, getValue()).map(
      (item) => item.characteristic,
    );

    if (
      currentItems.some(
        (item) => item.toLowerCase() === characteristic.toLowerCase(),
      )
    ) {
      return;
    }

    setValue([...currentItems, characteristic].join("\n"));
  }

  function openCompetencyEditor() {
    if (!selectedCompetencyRole) {
      return;
    }

    setEditTalentsValue(selectedCompetencyRole.talents.join("\n"));
    setEditSkillsValue(selectedCompetencyRole.skills.join("\n"));
    setEditBehaviorsValue(selectedCompetencyRole.behaviors.join("\n"));
    setIsEditingCompetencies(true);
  }

  function toggleEditLibraryCharacteristic(
    category: "talent" | "skill" | "behavior",
    characteristic: string,
  ) {
    const getValue = () => {
      if (category === "talent") {
        return editTalentsValue;
      }

      if (category === "skill") {
        return editSkillsValue;
      }

      return editBehaviorsValue;
    };

    const setValue = (nextValue: string) => {
      if (category === "talent") {
        setEditTalentsValue(nextValue);
        return;
      }

      if (category === "skill") {
        setEditSkillsValue(nextValue);
        return;
      }

      setEditBehaviorsValue(nextValue);
    };

    const currentItems = parseCharacteristicsTextarea(category, getValue()).map(
      (item) => item.characteristic,
    );
    const hasItem = currentItems.some(
      (item) => item.toLowerCase() === characteristic.toLowerCase(),
    );
    const nextItems = hasItem
      ? currentItems.filter((item) => item.toLowerCase() !== characteristic.toLowerCase())
      : [...currentItems, characteristic];

    setValue(nextItems.join("\n"));
  }

  function handleAddLibraryCompetency() {
    setAddLibraryCompetencyError(null);
    setAddLibraryCompetencySuccess(null);

    startAddLibraryCompetencyTransition(async () => {
      const response = await fetch("/api/roles/categorize-competency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competency: newLibraryCompetency,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        item?: SharedLibraryItem;
      };

      if (!response.ok || !result.item) {
        setAddLibraryCompetencyError(
          result.error ?? "Unable to categorize that competency.",
        );
        return;
      }

      const item = result.item;

      setSharedLibraryOverrides((current) => {
        const exists = current.some(
          (currentItem) =>
            currentItem.category === item.category &&
            currentItem.characteristic.toLowerCase() ===
              item.characteristic.toLowerCase(),
        );

        if (exists) {
          return current;
        }

        return [item, ...current];
      });
      addCharacteristicToEditor(item.category, item.characteristic);
      setNewLibraryCompetency("");
      setAddLibraryCompetencySuccess(
        result.message ?? `Filed as a ${item.category}.`,
      );
    });
  }

  function handleCreateRole() {
    setCreateError(null);
    setCreateSuccess(null);

    startCreateTransition(async () => {
      const payload = {
        roleId: editorRoleId || undefined,
        title,
        department,
        description,
        status,
        mentorProfileId: mentorProfileId || undefined,
        talents: parseCharacteristicsTextarea(
          "talent",
          talentsValue,
        ).map((item) => item.characteristic),
        skills: parseCharacteristicsTextarea(
          "skill",
          skillsValue,
        ).map((item) => item.characteristic),
        behaviors: parseCharacteristicsTextarea(
          "behavior",
          behaviorsValue,
        ).map((item) => item.characteristic),
      };
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        roleId?: string;
      };

      if (!response.ok) {
        setCreateError(result.error ?? "Unable to create role.");
        return;
      }

      if (result.roleId) {
        setEditorRoleId(result.roleId);
      }

      setCreateSuccess(result.message ?? "Role saved.");
      router.refresh();
    });
  }

  function handleUploadCharacteristics(formData: FormData) {
    setUploadCharacteristicsError(null);
    setUploadCharacteristicsSuccess(null);
    setEditCompetenciesError(null);
    setEditCompetenciesSuccess(null);
    setGenerateCompositeError(null);
    setGenerateCompositeSuccess(null);
    setDownloadCompositeError(null);
    setUploadCompositeDocumentError(null);
    setUploadCompositeDocumentSuccess(null);

    startUploadCharacteristicsTransition(async () => {
      const roleId = String(formData.get("roleId") ?? "");
      const response = await fetch("/api/roles/upload-characteristics", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setUploadCharacteristicsError(
          result.error ?? "Unable to upload role competencies.",
        );
        return;
      }

      uploadCharacteristicsFormRef.current?.reset();
      setUploadCharacteristicsResetKey((current) => current + 1);
      setSelectedCompetencyRoleId(roleId);
      setIsEditingCompetencies(false);
      setUploadCharacteristicsSuccess(
        result.message ?? "Role competencies uploaded.",
      );
      router.refresh();
    });
  }

  function handleEditCompetencies(formData: FormData) {
    if (!selectedCompetencyRoleId) {
      return;
    }

    setEditCompetenciesError(null);
    setEditCompetenciesSuccess(null);
    setUploadCharacteristicsError(null);
    setUploadCharacteristicsSuccess(null);
    setGenerateCompositeError(null);
    setGenerateCompositeSuccess(null);
    setDownloadCompositeError(null);
    setUploadCompositeDocumentError(null);
    setUploadCompositeDocumentSuccess(null);

    startEditCompetenciesTransition(async () => {
      const payload = {
        talents: parseCharacteristicsTextarea(
          "talent",
          String(formData.get("talents") ?? ""),
        ).map((item) => item.characteristic),
        skills: parseCharacteristicsTextarea(
          "skill",
          String(formData.get("skills") ?? ""),
        ).map((item) => item.characteristic),
        behaviors: parseCharacteristicsTextarea(
          "behavior",
          String(formData.get("behaviors") ?? ""),
        ).map((item) => item.characteristic),
      };

      const response = await fetch(
        `/api/roles/${selectedCompetencyRoleId}/ideal-competencies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setEditCompetenciesError(
          result.error ?? "Unable to save ideal candidate competencies.",
        );
        return;
      }

      setEditCompetenciesSuccess(
        result.message ?? "Ideal candidate competencies updated.",
      );
      setIsEditingCompetencies(false);
      router.refresh();
    });
  }

  function handleGenerateComposite() {
    if (!selectedCompetencyRoleId) {
      return;
    }

    setGenerateCompositeError(null);
    setGenerateCompositeSuccess(null);
    setUploadCharacteristicsError(null);
    setUploadCharacteristicsSuccess(null);
    setEditCompetenciesError(null);
    setEditCompetenciesSuccess(null);
    setDownloadCompositeError(null);
    setUploadCompositeDocumentError(null);
    setUploadCompositeDocumentSuccess(null);

    startGenerateCompositeTransition(async () => {
      const response = await fetch("/api/roles/generate-composite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleId: selectedCompetencyRoleId,
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setGenerateCompositeError(
          result.error ?? "Unable to generate the role composite.",
        );
        return;
      }

      setGenerateCompositeSuccess(
        result.message ?? "Role composite generated.",
      );
      router.refresh();
    });
  }

  function handleDownloadCompositeDocument() {
    if (!selectedCompetencyRoleId || !selectedCompetencyRole) {
      return;
    }

    setDownloadCompositeError(null);
    setUploadCompositeDocumentError(null);
    setUploadCompositeDocumentSuccess(null);
    startDownloadCompositeTransition(async () => {
      const currentRole = selectedCompetencyRole;
      const response = await fetch(
        `/api/roles/${selectedCompetencyRoleId}/composite-docx`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setDownloadCompositeError(
          result.error ?? "Unable to generate the role composite document.",
        );
        return;
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${currentRole.title
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()}-role-composite.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    });
  }

  function handleUploadCompositeDocument(formData: FormData) {
    if (!selectedCompetencyRoleId) {
      return;
    }

    setUploadCompositeDocumentError(null);
    setUploadCompositeDocumentSuccess(null);
    setGenerateCompositeError(null);
    setGenerateCompositeSuccess(null);
    setDownloadCompositeError(null);

    startUploadCompositeDocumentTransition(async () => {
      const response = await fetch(
        `/api/roles/${selectedCompetencyRoleId}/composite-docx`,
        {
          method: "POST",
          body: formData,
        },
      );
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setUploadCompositeDocumentError(
          result.error ?? "Unable to upload the corrected role composite.",
        );
        return;
      }

      setUploadCompositeDocumentResetKey((current) => current + 1);
      setUploadCompositeDocumentSuccess(
        result.message ?? "Role composite document uploaded.",
      );
      router.refresh();
    });
  }

  function getCompositeStatusTitle(role: RoleOption) {
    if (role.compositeDocumentSource === "manual") {
      return "Manual Word composite on file";
    }

    if (role.compositeDocumentSource === "generated") {
      return "Generated once and locked";
    }

    if (role.roleCompositeCount > 0) {
      return "Ready to create document";
    }

    return "Not created yet";
  }

  function getCompositeStatusBody(role: RoleOption) {
    if (role.compositeDocumentSource === "manual") {
      return role.compositeDocumentFileName
        ? `Manual corrections are stored in ${role.compositeDocumentFileName}. Download it, edit it in Word, and upload the revised version when needed.`
        : "A manual Word composite is stored for this role. Download it, edit it in Word, and upload the revised version when needed.";
    }

    if (role.compositeDocumentSource === "generated") {
      return "The AI-created Word composite has been created for this role. From this point forward, changes should happen by downloading it, editing it in Word, and uploading the corrected version.";
    }

    if (role.roleCompositeCount > 0) {
      return `This role already has ${role.roleCompositeCount} structured competency area${role.roleCompositeCount === 1 ? "" : "s"}. Create the Word composite once, then maintain it manually.`;
    }

    return "Upload competencies first, then create the Word composite once. After that, the document should be maintained manually.";
  }

  return (
    <section className="grid gap-6">
      {mode === "create" ? (
        <div className="grid gap-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Manual Role Editor
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Create or edit a role manually
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Build a new role from scratch or load an existing one to refine it.
              This keeps each role&apos;s own competency set preserved while also
              letting you pull from the shared competency library as it grows.
            </p>

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateRole();
              }}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Role record
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  value={editorRoleId}
                  onChange={(event) => applyEditorRole(event.currentTarget.value)}
                >
                  <option value="">Create a new role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      Edit {role.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Role title
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  placeholder="Example: Director of Operations"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Department
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                  type="text"
                  value={department}
                  onChange={(event) => setDepartment(event.currentTarget.value)}
                  placeholder="Example: Operations"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </span>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                  value={description}
                  onChange={(event) => setDescription(event.currentTarget.value)}
                  placeholder="Example: Leads day-to-day operations, aligns teams around performance goals, and ensures consistent execution across the organization."
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Status
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.currentTarget.value as "draft" | "active")
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </label>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Competency Options
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  You can upload competencies from an Excel spreadsheet, or you can
                  manually input them from the selections below.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={openCompetencyImport}
                    className="interactive-contrast rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
                  >
                    Upload Competency Spreadsheet
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Ideal competencies: talents
                    </span>
                    <textarea
                      className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                      value={talentsValue}
                      onChange={(event) => setTalentsValue(event.currentTarget.value)}
                      placeholder={"Example:\nStrategic thinker\nRelationship builder\nLearner"}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Ideal competencies: skills
                    </span>
                    <textarea
                      className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                      value={skillsValue}
                      onChange={(event) => setSkillsValue(event.currentTarget.value)}
                      placeholder={"Example:\nBudget planning\nTeam development\nProject management"}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Ideal competencies: behaviors
                    </span>
                    <textarea
                      className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                      value={behaviorsValue}
                      onChange={(event) => setBehaviorsValue(event.currentTarget.value)}
                      placeholder={"Example:\nCommunicates clearly under pressure\nBuilds trust across teams\nCoaches with accountability"}
                    />
                  </label>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                    Shared Competency Library
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Click any saved item to add it to this role, or click it again
                    to remove it from the editor.
                  </p>
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Add a competency
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Type one competency and we&apos;ll categorize it as a
                      talent, skill, or behavior, then add it to this role and
                      the shared library.
                    </p>
                    <div className="mt-3 flex flex-col gap-3">
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                        type="text"
                        value={newLibraryCompetency}
                        onChange={(event) =>
                          setNewLibraryCompetency(event.currentTarget.value)
                        }
                        placeholder="Ex: Builds trust quickly"
                      />
                      <button
                        type="button"
                        onClick={handleAddLibraryCompetency}
                        disabled={
                          isAddLibraryCompetencyPending ||
                          newLibraryCompetency.trim().length === 0
                        }
                        className="interactive-contrast rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isAddLibraryCompetencyPending
                          ? "Categorizing..."
                          : "Categorize and Add"}
                      </button>
                    </div>
                    {addLibraryCompetencyError ? (
                      <p className="mt-3 text-sm text-rose-700">
                        {addLibraryCompetencyError}
                      </p>
                    ) : null}
                    {addLibraryCompetencySuccess ? (
                      <p className="mt-3 text-sm text-teal-700">
                        {addLibraryCompetencySuccess}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-5 grid gap-4">
                    {[
                      {
                        title: "Talents",
                        category: "talent" as const,
                        items: sharedLibraryByCategory.talents,
                        currentValue: talentsValue,
                      },
                      {
                        title: "Skills",
                        category: "skill" as const,
                        items: sharedLibraryByCategory.skills,
                        currentValue: skillsValue,
                      },
                      {
                        title: "Behaviors",
                        category: "behavior" as const,
                        items: sharedLibraryByCategory.behaviors,
                        currentValue: behaviorsValue,
                      },
                    ].map((section) => {
                      const currentItems = new Set(
                        parseCharacteristicsTextarea(
                          section.category,
                          section.currentValue,
                        ).map((item) => item.characteristic.toLowerCase()),
                      );

                      return (
                        <div key={section.category}>
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            {section.title}
                          </p>
                          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                            {section.items.length > 0 ? (
                              section.items.map((item) => {
                                const isSelected = currentItems.has(
                                  item.characteristic.toLowerCase(),
                                );

                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() =>
                                      toggleLibraryCharacteristic(
                                        section.category,
                                        item.characteristic,
                                      )
                                    }
                                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                      isSelected
                                        ? "bg-teal-700 text-white"
                                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                    }`}
                                  >
                                    {item.characteristic}
                                  </button>
                                );
                              })
                            ) : (
                              <p className="text-sm text-slate-500">
                                No shared {section.title.toLowerCase()} yet.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="submit"
                  disabled={isCreatePending}
                >
                  {isCreatePending
                    ? selectedEditorRole
                      ? "Saving role..."
                      : "Creating role..."
                    : selectedEditorRole
                      ? "Save Role Changes"
                      : "Create Role"}
                </button>
                {selectedEditorRole ? (
                  <button
                    type="button"
                    onClick={() => applyEditorRole("")}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Start a New Role
                  </button>
                ) : null}
              </div>
            </form>

            {createError ? <p className="mt-4 text-sm text-rose-700">{createError}</p> : null}
            {createSuccess ? (
              <p className="mt-4 text-sm text-teal-700">{createSuccess}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "import" ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Upload Competencies
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          Import ideal candidate competencies
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Upload a CSV or XLSX file with ideal candidate competencies, then
          attach it to an existing role. This can include spreadsheet formats
          with headers like Type of Set and Competency, or grouped columns like
          Talents, Skills, and Behaviors.
        </p>

        <form
          ref={uploadCharacteristicsFormRef}
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleUploadCharacteristics(new FormData(event.currentTarget));
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Role
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              name="roleId"
              value={selectedCompetencyRoleId}
              onChange={(event) => {
                setSelectedCompetencyRoleId(event.currentTarget.value);
                setIsEditingCompetencies(false);
                setUploadCharacteristicsError(null);
                setUploadCharacteristicsSuccess(null);
                setEditCompetenciesError(null);
                setEditCompetenciesSuccess(null);
                setGenerateCompositeError(null);
                setGenerateCompositeSuccess(null);
                setDownloadCompositeError(null);
                setUploadCompositeDocumentError(null);
                setUploadCompositeDocumentSuccess(null);
              }}
              required
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title}
                </option>
              ))}
            </select>
          </label>
          {selectedCompetencyRole ? (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Ideal Candidate Competencies
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {selectedCompetencyRole.idealCompetencyCount > 0
                  ? `${selectedCompetencyRole.idealCompetencyCount} uploaded`
                  : "Not uploaded yet"}
              </p>
              <p className="mt-2 leading-7">
                {selectedCompetencyRole.idealCompetencyCount > 0
                  ? "This role already has ideal candidate competencies attached."
                  : "Upload a spreadsheet or enter them manually below."}
              </p>
            </article>
          ) : null}
          <FileDropInput
            key={uploadCharacteristicsResetKey}
            label="Competencies file"
            name="file"
            accept=".csv,.xlsx"
            required
            helperText="Accepted formats: CSV or XLSX. Use columns like Competency, Talents, Skills, Behaviors, or rows with Type of Set and Competency. Legacy XLS files should be resaved as XLSX first."
          />
          <button
            className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            type="submit"
            disabled={isUploadCharacteristicsPending || roles.length === 0}
          >
            {isUploadCharacteristicsPending
              ? "Importing competencies..."
              : "Upload Ideal Candidate Competencies"}
          </button>
        </form>

        {selectedCompetencyRole ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              type="button"
              onClick={() => {
                if (isEditingCompetencies) {
                  setIsEditingCompetencies(false);
                  return;
                }

                openCompetencyEditor();
              }}
            >
              {isEditingCompetencies ? "Close Competency Editor" : "Edit Competencies"}
            </button>
            <button
              type="button"
              onClick={openCompositePage}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open Role Composite Page
            </button>
          </div>
        ) : null}

        {selectedCompetencyRole && isEditingCompetencies ? (
          <form
            key={`${selectedCompetencyRole.id}-${selectedCompetencyRole.idealCompetencyCount}-${selectedCompetencyRole.roleCompositeCount}`}
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              formData.set("talents", editTalentsValue);
              formData.set("skills", editSkillsValue);
              formData.set("behaviors", editBehaviorsValue);
              handleEditCompetencies(formData);
            }}
          >
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Talents
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    name="talents"
                    value={editTalentsValue}
                    onChange={(event) => setEditTalentsValue(event.currentTarget.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Skills
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    name="skills"
                    value={editSkillsValue}
                    onChange={(event) => setEditSkillsValue(event.currentTarget.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Behaviors
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    name="behaviors"
                    value={editBehaviorsValue}
                    onChange={(event) => setEditBehaviorsValue(event.currentTarget.value)}
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Shared Competency Library
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Click any saved item to add it to this role, or click it again
                  to remove it from the editor.
                </p>
                <div className="mt-5 grid gap-4">
                  {[
                    {
                      title: "Talents",
                      category: "talent" as const,
                      items: sharedLibraryByCategory.talents,
                      currentValue: editTalentsValue,
                    },
                    {
                      title: "Skills",
                      category: "skill" as const,
                      items: sharedLibraryByCategory.skills,
                      currentValue: editSkillsValue,
                    },
                    {
                      title: "Behaviors",
                      category: "behavior" as const,
                      items: sharedLibraryByCategory.behaviors,
                      currentValue: editBehaviorsValue,
                    },
                  ].map((section) => {
                    const currentItems = new Set(
                      parseCharacteristicsTextarea(
                        section.category,
                        section.currentValue,
                      ).map((item) => item.characteristic.toLowerCase()),
                    );

                    return (
                      <div key={section.category}>
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          {section.title}
                        </p>
                        <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                          {section.items.length > 0 ? (
                            section.items.map((item) => {
                              const isSelected = currentItems.has(
                                item.characteristic.toLowerCase(),
                              );

                              return (
                                <button
                                  key={`edit-${item.id}`}
                                  type="button"
                                  onClick={() =>
                                    toggleEditLibraryCharacteristic(
                                      section.category,
                                      item.characteristic,
                                    )
                                  }
                                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                    isSelected
                                      ? "bg-teal-700 text-white"
                                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  {item.characteristic}
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-500">
                              No shared {section.title.toLowerCase()} yet.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                type="submit"
                disabled={isEditCompetenciesPending}
              >
                {isEditCompetenciesPending
                  ? "Saving competencies..."
                  : "Save Ideal Candidate Competencies"}
              </button>
              <button
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={() => setIsEditingCompetencies(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        {roles.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Create a role first so the uploaded competencies have somewhere to land.
          </p>
        ) : null}
        {uploadCharacteristicsError ? (
          <p className="mt-4 text-sm text-rose-700">{uploadCharacteristicsError}</p>
        ) : null}
        {uploadCharacteristicsSuccess ? (
          <p className="mt-4 text-sm text-teal-700">{uploadCharacteristicsSuccess}</p>
        ) : null}
        {editCompetenciesError ? (
          <p className="mt-4 text-sm text-rose-700">{editCompetenciesError}</p>
        ) : null}
        {editCompetenciesSuccess ? (
          <p className="mt-4 text-sm text-teal-700">{editCompetenciesSuccess}</p>
        ) : null}
        </div>
      ) : null}

      {mode === "composite" ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Role Composite
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            Create, download, and maintain the role composite
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Once competencies are attached to a role, generate the composite one
            time, download it in Word, and maintain future corrections through
            manual Word uploads.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Role
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                value={selectedCompetencyRoleId}
                onChange={(event) => {
                  setSelectedCompetencyRoleId(event.currentTarget.value);
                  setGenerateCompositeError(null);
                  setGenerateCompositeSuccess(null);
                  setDownloadCompositeError(null);
                  setUploadCompositeDocumentError(null);
                  setUploadCompositeDocumentSuccess(null);
                }}
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedCompetencyRole ? (
              <div className="grid gap-3 md:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                    Ideal Candidate Competencies
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {selectedCompetencyRole.idealCompetencyCount > 0
                      ? `${selectedCompetencyRole.idealCompetencyCount} uploaded`
                      : "Not uploaded yet"}
                  </p>
                  <p className="mt-2 leading-7">
                    {selectedCompetencyRole.idealCompetencyCount > 0
                      ? "This role is ready for composite generation."
                      : "Upload competencies first so the composite can be built from real role data."}
                  </p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                    Role Composite
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {getCompositeStatusTitle(selectedCompetencyRole)}
                  </p>
                  <p className="mt-2 leading-7">
                    {getCompositeStatusBody(selectedCompetencyRole)}
                  </p>
                </article>
              </div>
            ) : null}

            {selectedCompetencyRole ? (
              <div className="flex flex-wrap gap-3">
                <button
                  className="interactive-contrast rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-900/40"
                  type="button"
                  onClick={handleGenerateComposite}
                  disabled={
                    isGenerateCompositePending ||
                    selectedCompetencyRole.idealCompetencyCount === 0 ||
                    selectedCompetencyRole.compositeDocumentSource !== null ||
                    !canGenerateComposite
                  }
                >
                  {isGenerateCompositePending
                    ? "Generating role composite..."
                    : "Generate Role Composite"}
                </button>
                <button
                  className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="button"
                  onClick={handleDownloadCompositeDocument}
                  disabled={
                    isDownloadCompositePending ||
                    selectedCompetencyRole.compositeDocumentSource === null
                  }
                >
                  {isDownloadCompositePending
                    ? "Downloading document..."
                    : "Download Role Composite Document"}
                </button>
                <button
                  type="button"
                  onClick={openCompetencyImport}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Back to Competencies
                </button>
              </div>
            ) : null}

            {selectedCompetencyRole ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleUploadCompositeDocument(new FormData(event.currentTarget));
                }}
              >
                <FileDropInput
                  key={`${selectedCompetencyRole.id}-${uploadCompositeDocumentResetKey}`}
                  label="Corrected Word composite"
                  name="file"
                  accept=".docx"
                  required
                  helperText={
                    selectedCompetencyRole.roleCompositeCount > 0
                      ? "Upload the revised Word version after editing the composite manually. Accepted format: DOCX."
                      : "Generate the role composite first so the structured competency model is in place, then upload the corrected Word version here."
                  }
                />
                <button
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  type="submit"
                  disabled={
                    isUploadCompositeDocumentPending ||
                    selectedCompetencyRole.roleCompositeCount === 0
                  }
                >
                  {isUploadCompositeDocumentPending
                    ? "Uploading corrected document..."
                    : selectedCompetencyRole.compositeDocumentSource === null
                      ? "Upload Manual Word Composite"
                      : "Upload Corrected Word Composite"}
                </button>
              </form>
            ) : null}
          </div>

          {!canGenerateComposite && selectedCompetencyRole ? (
            <p className="mt-4 text-sm text-slate-600">
              Add `OPENAI_API_KEY` in `.env.local` to enable the one-time role
              composite generation step from uploaded competencies.
            </p>
          ) : null}
          {generateCompositeError ? (
            <p className="mt-4 text-sm text-rose-700">{generateCompositeError}</p>
          ) : null}
          {generateCompositeSuccess ? (
            <p className="mt-4 text-sm text-teal-700">{generateCompositeSuccess}</p>
          ) : null}
          {downloadCompositeError ? (
            <p className="mt-4 text-sm text-rose-700">{downloadCompositeError}</p>
          ) : null}
          {uploadCompositeDocumentError ? (
            <p className="mt-4 text-sm text-rose-700">{uploadCompositeDocumentError}</p>
          ) : null}
          {uploadCompositeDocumentSuccess ? (
            <p className="mt-4 text-sm text-teal-700">
              {uploadCompositeDocumentSuccess}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
