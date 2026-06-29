"use client";

import { useId, useRef, useState } from "react";

type FileDropInputProps = {
  accept: string;
  helperText: string;
  label: string;
  name: string;
  multiple?: boolean;
  required?: boolean;
  theme?: "light" | "dark" | "emerald";
};

export function FileDropInput({
  accept,
  helperText,
  label,
  name,
  multiple = false,
  required = false,
  theme = "light",
}: FileDropInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);

  const allowedExtensions = accept
    .split(",")
    .map((value) => value.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);

  function clearSelectedFiles() {
    setSelectedFileNames([]);

    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.setCustomValidity("");
    }
  }

  function syncFiles(fileList: FileList | null) {
    setSelectedFileNames(
      fileList ? Array.from(fileList).map((file) => file.name) : [],
    );
  }

  function validateFiles(files: File[]) {
    const invalidFile = files.find((file) => {
      const extension = file.name.toLowerCase().split(".").at(-1) ?? "";
      return !allowedExtensions.includes(extension);
    });

    if (invalidFile) {
      const message = `This upload only accepts ${allowedExtensions
        .map((value) => value.toUpperCase())
        .join(" or ")} files.`;

      setFileError(message);
      clearSelectedFiles();
      return false;
    }

    setFileError("");
    return true;
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length || !inputRef.current) {
      return;
    }

    const nextFiles = Array.from(fileList);

    if (!validateFiles(nextFiles)) {
      return;
    }

    const transfer = new DataTransfer();

    nextFiles.forEach((file) => {
      transfer.items.add(file);
    });

    inputRef.current.files = transfer.files;
    syncFiles(transfer.files);
  }

  const selectedFilesLabel =
    selectedFileNames.length === 0
      ? `Drag and drop ${multiple ? "files" : "a file"} here or choose ${
          multiple ? "them" : "one"
        } manually`
      : selectedFileNames.length === 1
        ? selectedFileNames[0]
        : `${selectedFileNames.length} files selected: ${selectedFileNames
            .slice(0, 3)
            .join(", ")}${selectedFileNames.length > 3 ? ` +${selectedFileNames.length - 3} more` : ""}`;

  const isDark = theme === "dark";
  const isEmerald = theme === "emerald";
  const containerClassName = isDark
    ? `rounded-2xl border border-dashed px-4 py-4 transition ${
        isDragging
          ? "border-white/60 bg-white/15"
          : "border-white/20 bg-white/5 hover:bg-white/10"
      }`
    : isEmerald
      ? `rounded-2xl border border-dashed px-4 py-4 transition ${
          isDragging
            ? "border-[#2d7c38] bg-white/55"
            : "border-[#57c95f] bg-white/35 hover:bg-white/45"
        }`
    : `rounded-2xl border border-dashed px-4 py-4 transition ${
        isDragging
          ? "border-teal-500 bg-teal-50"
          : "border-slate-300 bg-slate-50 hover:bg-white"
      }`;
  const buttonClassName = isDark
    ? "rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
    : isEmerald
      ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
    : "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900";
  const fileNameClassName = isDark
    ? "text-white"
    : isEmerald
      ? "text-[#14361d]"
      : "text-slate-900";
  const helperClassName = isDark
    ? "text-teal-100"
    : isEmerald
      ? "text-[#2d5b37]"
      : "text-slate-500";

  return (
    <div className="block">
      <span
        className={`mb-2 block text-sm font-semibold ${
          isDark ? "text-teal-100" : isEmerald ? "text-[#24512f]" : "text-slate-700"
        }`}
      >
        {label}
      </span>
      <input
        ref={inputRef}
        id={inputId}
        className="sr-only"
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        required={required}
        onChange={(event) => {
          const nextFiles = Array.from(event.currentTarget.files ?? []);

          if (nextFiles.length === 0) {
            setFileError("");
            syncFiles(event.currentTarget.files);
            return;
          }

          if (!validateFiles(nextFiles)) {
            return;
          }

          syncFiles(event.currentTarget.files);
        }}
      />
      <div
        className={containerClassName}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          const nextTarget = event.relatedTarget;

          if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
            return;
          }

          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className={`${buttonClassName}${isDark ? " interactive-contrast" : ""}`}
            type="button"
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            {multiple ? "Choose Files" : "Choose File"}
          </button>
          <div className="min-w-0">
            <p className={`truncate text-sm ${fileNameClassName}`}>
              {selectedFilesLabel}
            </p>
            <p className={`mt-1 text-xs ${helperClassName}`}>{helperText}</p>
            {fileError ? (
              <p className={`mt-2 text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>
                {fileError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
