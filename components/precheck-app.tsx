"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Check = {
  id: string;
  name: string;
  description: string;
  prompt: string;
};

type UploadedFile = {
  id: string;
  file: File;
};

type CheckStatus = "idle" | "processing" | "pass" | "fail" | "warning";

type CheckState = {
  status: CheckStatus;
  summary?: string;
};

type ApiPayloadFile = {
  name: string;
  type: string;
  content: string;
};

type Props = {
  checks: Check[];
};

const createLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function PrecheckApp({ checks }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const initialCheckState = useMemo(() => {
    return checks.reduce<Record<string, CheckState>>((acc, check) => {
      acc[check.id] = { status: "idle", summary: "" };
      return acc;
    }, {});
  }, [checks]);
  const [checkStates, setCheckStates] = useState<Record<string, CheckState>>(
    initialCheckState,
  );
  const [summaryText, setSummaryText] = useState("");
  const [todoItems, setTodoItems] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setCheckStates(initialCheckState);
  }, [initialCheckState]);

  const resetResults = useCallback(() => {
    setCheckStates(
      checks.reduce<Record<string, CheckState>>((acc, check) => {
        acc[check.id] = { status: "processing" };
        return acc;
      }, {}),
    );
    setSummaryText("");
    setTodoItems([]);
  }, [checks]);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const accepted: UploadedFile[] = [];
    Array.from(incoming).forEach((file) => {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setError("Only PDF files are supported right now.");
        return;
      }
      accepted.push({ id: createLocalId(), file });
    });

    if (accepted.length) {
      setFiles((prev) => [...prev, ...accepted]);
      setError("");
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer?.files?.length) {
        handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const toBase64 = async (file: File) => {
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const runChecks = useCallback(async () => {
    if (!files.length || isRunning) {
      if (!files.length) {
        setError("Add at least one PDF before running the pre-check.");
      }
      return;
    }

    setError("");
    setHasRun(true);
    setIsRunning(true);
    resetResults();

    try {
      const payloadFiles: ApiPayloadFile[] = [];
      for (const { file } of files) {
        const content = await toBase64(file);
        payloadFiles.push({
          name: file.name,
          type: file.type || "application/pdf",
          content,
        });
      }

      const response = await fetch("/api/run-checks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: payloadFiles,
          checks,
        }),
      });

      if (!response.body) {
        throw new Error("Unable to read response stream.");
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "OpenAI request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }
        try {
          const payload = JSON.parse(trimmed);
          if ("check" in payload && payload.check?.id) {
            const resultStatus = payload.check.status as CheckStatus;
            setCheckStates((prev) => ({
              ...prev,
              [payload.check.id]: {
                status: resultStatus,
                summary: payload.check.summary,
              },
            }));
          } else if ("summary" in payload) {
            setSummaryText(payload.summary);
          } else if ("todo" in payload && Array.isArray(payload.todo)) {
            setTodoItems(payload.todo);
          }
        } catch {
          // ignore malformed chunks
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            processLine(buffer);
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          processLine(line);
          newlineIndex = buffer.indexOf("\n");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error occurred.");
    } finally {
      setIsRunning(false);
    }
  }, [checks, files, isRunning, resetResults]);

  const renderIndicator = (status: CheckStatus) => {
    if (!hasRun || status === "idle") {
      return null;
    }

    if (status === "processing") {
      return (
        <LoaderCircleIcon className="h-5 w-5 animate-spin text-neutral-800" />
      );
    }

    if (status === "pass") {
      return <CheckIcon className="h-5 w-5 text-lime-700" />;
    }

    if (status === "fail") {
      return <XIcon className="h-5 w-5 text-red-700" />;
    }

    if (status === "warning") {
      return <TriangleAlertIcon className="h-5 w-5 text-amber-700" />;
    }

    return null;
  };

  return (
    <div className="w-full max-w-4xl">
      <header className="mb-10 space-y-1">
        <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
          New-Jersey
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">
          SERFF Compliance Pre-Check
        </h1>
      </header>

      <section className="mb-6 space-y-4">
        <div
          className={`flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-sm border text-center transition ${
            isDragging
              ? "border-lime-500 bg-lime-50"
              : "border-neutral-200 bg-white"
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <FileUpIcon className="mb-3 h-8 w-8 text-neutral-500" />
          <p className="text-lg font-medium text-neutral-800">
            Upload documents
          </p>
          <p className="text-sm text-neutral-500">PDF files only</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) {
                handleFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </div>

        {!!files.length && (
          <ul className="space-y-2">
            {files.map(({ id, file }) => (
              <li
                key={id}
                className="flex items-center justify-between rounded-sm border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700"
              >
                <span className="truncate" title={file.name}>
                  {file.name}
                </span>
                <button
                  type="button"
                  className="group ml-4 flex h-8 w-8 items-center justify-center rounded-full transition"
                  onClick={() => removeFile(id)}
                  aria-label={`Remove ${file.name}`}
                >
                  <CheckIcon className="h-5 w-5 text-lime-700 group-hover:hidden" />
                  <TrashIcon className="hidden h-5 w-5 text-red-700 group-hover:block" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-10 flex justify-center">
        <button
          type="button"
          onClick={runChecks}
          disabled={isRunning || !files.length}
          className="rounded-sm bg-lime-500 px-6 py-3 text-base font-medium text-neutral-900 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? "Running checks..." : "Run SERFF compliance pre-check"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-neutral-900">Checklist</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {checks.map((check) => {
            const currentState = checkStates[check.id] || {
              status: "idle",
              summary: "",
            };
            return (
              <article
                key={check.id}
                className="rounded-sm border border-neutral-200 bg-white p-4"
              >
                <div className="mb-1 flex items-center gap-2">
                  <h4 className="text-lg font-medium text-neutral-900">
                    {check.name}
                  </h4>
                  {renderIndicator(currentState.status)}
                </div>
                <p className="text-sm text-neutral-600">{check.description}</p>
                {currentState.summary && (
                  <p
                    className={`mt-3 text-sm ${
                      currentState.status === "pass"
                        ? "text-lime-800"
                        : currentState.status === "fail"
                          ? "text-red-800"
                          : "text-amber-800"
                    }`}
                  >
                    {currentState.summary}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {summaryText && (
        <section className="mt-10 space-y-2 rounded-sm border border-neutral-200 bg-white p-4">
          <h3 className="text-xl font-semibold text-neutral-900">Summary</h3>
          <p className="text-sm text-neutral-700">{summaryText}</p>
        </section>
      )}

      {todoItems.length > 0 && (
        <section className="mt-6 space-y-3 rounded-sm border border-neutral-200 bg-white p-4">
          <h3 className="text-xl font-semibold text-neutral-900">To-Do</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {todoItems.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type IconProps = React.SVGProps<SVGSVGElement>;

const IconBase = ({ className, children, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

const FileUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path d="M12 12v6" />
    <path d="m15 15-3-3-3 3" />
  </IconBase>
);

const CheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20 6 9 17l-5-5" />
  </IconBase>
);

const TrashIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </IconBase>
);

const LoaderCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </IconBase>
);

const TriangleAlertIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </IconBase>
);

const XIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </IconBase>
);
